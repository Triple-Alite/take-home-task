'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { io, Socket } from 'socket.io-client';
import { signOut, User } from 'firebase/auth';
import { apiRequest, Company, CompanyImage, SessionProfile, socketBase } from '@/lib/api';
import { calculatePercentage } from '@/lib/percentage';
import { getFirebaseAuth } from '@/lib/firebase';
import { PercentagePreview } from './PercentagePreview';
import { PrivateImage } from './PrivateImage';

const companySchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(120, 'Name must be 120 characters or fewer'),
  userCount: z.number({ invalid_type_error: 'Enter a whole number' }).int().min(0).max(10_000_000),
  productCount: z.number({ invalid_type_error: 'Enter a whole number' }).int().min(0).max(10_000_000)
});
type CompanyForm = z.infer<typeof companySchema>;

const emptyForm: CompanyForm = { name: '', userCount: 0, productCount: 0 };

export function Workspace({ user, profile }: { user: User; profile: SessionProfile }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [images, setImages] = useState<CompanyImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const isOwner = profile.role === 'owner';
  const auth = getFirebaseAuth();
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: emptyForm
  });
  const watchedUsers = useWatch({ control, name: 'userCount' }) ?? 0;
  const watchedProducts = useWatch({ control, name: 'productCount' }) ?? 0;
  const preview = calculatePercentage(Number(watchedUsers), Number(watchedProducts));

  async function refreshImages(): Promise<void> {
    const result = await apiRequest<CompanyImage[]>('/images');
    setImages(result);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Company>('/company').catch(() => null),
      apiRequest<CompanyImage[]>('/images').catch(() => [])
    ]).then(([latest, currentImages]) => {
      if (!active) return;
      setCompany(latest);
      setImages(currentImages);
      if (latest) reset({ name: latest.name, userCount: latest.userCount, productCount: latest.productCount });
      setLoading(false);
    });
    return () => { active = false; };
  }, [reset]);

  useEffect(() => {
    let socket: Socket | undefined;
    let active = true;
    void user.getIdToken().then((token) => {
      if (!active) return;
      socket = io(`${socketBase()}/collaboration`, { auth: { token }, transports: ['websocket'] });
      socket.on('company:updated', (latest: Company) => {
        setCompany(latest);
        setMessage('Company information is now in sync.');
        if (profile.role === 'owner') reset({ name: latest.name, userCount: latest.userCount, productCount: latest.productCount });
      });
      socket.on('image:uploaded', () => { void refreshImages().catch(() => undefined); });
    }).catch(() => undefined);
    return () => { active = false; socket?.disconnect(); };
  }, [user, profile.role, reset]);

  async function saveCompany(values: CompanyForm): Promise<void> {
    setError('');
    setMessage('');
    try {
      const saved = await apiRequest<Company>('/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      setCompany(saved);
      setMessage('Company information saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save company information.');
    }
  }

  async function uploadImage(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file');
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      setError('Choose an image before uploading.');
      return;
    }
    const data = new FormData();
    data.set('file', input.files[0]);
    setUploading(true);
    setError('');
    setMessage('');
    try {
      await apiRequest<CompanyImage>('/images', { method: 'POST', body: data });
      await refreshImages();
      form.reset();
      setMessage('Image uploaded securely.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  }

  async function logout(): Promise<void> {
    if (auth) await signOut(auth);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Company Desk home">
          <span className="brand-mark">C</span><span>company<br />desk<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="nav-current"><span className="nav-indicator" />Company overview</div>
        <div className="sidebar-bottom">
          <div className="profile-avatar" aria-hidden="true">{isOwner ? 'A' : 'B'}</div>
          <div className="profile-copy"><strong>{isOwner ? 'Data owner' : 'Collaborator'}</strong><span>{isOwner ? 'Editor access' : 'Contributor access'}</span></div>
          <button className="signout-button" type="button" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-divider">/</span><strong>Company overview</strong></div>
          <div className="live-status"><span />Live sync</div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div><p className="eyebrow">SHARED COMPANY RECORD</p><h1>{isOwner ? 'Your company, in sync.' : 'The latest from your team.'}</h1><p className="heading-subtitle">{isOwner ? 'Keep the source of truth current for your collaborator.' : 'Company details stay current as soon as they are submitted.'}</p></div>
            <div className="record-badge"><span className="record-dot" />PRIVATE WORKSPACE</div>
          </div>

          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {message && <div className="notice notice-success" role="status">{message}</div>}

          <section className="company-section" aria-labelledby="company-heading">
            <div className="section-heading"><div><p className="eyebrow">01 / COMPANY DETAILS</p><h2 id="company-heading">Company profile</h2></div><span className="section-caption">{company ? `Updated ${new Date(company.updatedAt).toLocaleDateString()}` : 'Not submitted yet'}</span></div>
            {loading ? <div className="loading-line" role="status">Loading company information…</div> : isOwner ? (
              <form className="company-form" onSubmit={handleSubmit(saveCompany)}>
                <label className="field field-name"><span>Company name</span><input {...register('name')} placeholder="e.g. Northstar Labs" autoComplete="organization" aria-invalid={!!errors.name} />{errors.name && <small>{errors.name.message}</small>}</label>
                <label className="field"><span>Number of users</span><input type="number" inputMode="numeric" min="0" step="1" {...register('userCount', { valueAsNumber: true })} aria-invalid={!!errors.userCount} />{errors.userCount && <small>{errors.userCount.message}</small>}</label>
                <label className="field"><span>Number of products</span><input type="number" inputMode="numeric" min="0" step="1" {...register('productCount', { valueAsNumber: true })} aria-invalid={!!errors.productCount} />{errors.productCount && <small>{errors.productCount.message}</small>}</label>
                <div className="form-footer"><PercentagePreview value={preview} /><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : company ? 'Save changes' : 'Submit company'}</button></div>
              </form>
            ) : company ? (
              <div className="company-readonly">
                <div className="readonly-name"><span className="eyebrow">COMPANY</span><strong>{company.name}</strong></div>
                <div className="readonly-stat"><span>Users</span><strong>{company.userCount.toLocaleString()}</strong></div>
                <div className="readonly-stat"><span>Products</span><strong>{company.productCount.toLocaleString()}</strong></div>
                <PercentagePreview value={company.percentage} />
              </div>
            ) : <div className="empty-company"><span className="empty-symbol">—</span><div><strong>Company details are on their way.</strong><p>The owner has not submitted a company profile yet.</p></div></div>}
          </section>

          <section className="images-section" aria-labelledby="images-heading">
            <div className="section-heading"><div><p className="eyebrow">02 / SHARED FILES</p><h2 id="images-heading">Company images <span className="count-pill">{images.length}</span></h2></div>{isOwner && <span className="section-caption">Uploaded by your collaborator</span>}</div>
            {profile.role === 'collaborator' && <form className="upload-row" onSubmit={uploadImage}>
              <label className="file-control"><span>Choose image</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a JPEG, PNG, or WebP image" /></label>
              <span className="upload-hint">JPEG, PNG, WebP · up to 5 MB</span>
              <button className="upload-button" type="submit" disabled={uploading || !company}>{uploading ? 'Uploading…' : 'Upload image'}</button>
            </form>}
            {images.length ? <div className="image-grid">{images.map((image) => <PrivateImage key={image.id} image={image} />)}</div> : <div className="empty-images"><span className="empty-image-icon" aria-hidden="true">＋</span><div><strong>No images shared yet</strong><p>{isOwner ? 'Images uploaded by your collaborator will appear here.' : 'Add a company image to share it with the owner.'}</p></div></div>}
          </section>

          <footer className="content-footer"><span>COMPANY DESK</span><span>Only your two authorized accounts can access this workspace.</span></footer>
        </div>
      </section>
    </main>
  );
}
