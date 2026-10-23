'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { io, Socket } from 'socket.io-client';
import { signOut, User } from 'firebase/auth';
import { apiRequest, apiUpload, ApiRequestError, Company, CompanyImage, PaginatedImages, SessionProfile, socketBase } from '@/lib/api';
import { calculatePercentage } from '@/lib/percentage';
import { getFirebaseAuth } from '@/lib/firebase';
import { PercentagePreview } from './PercentagePreview';
import { PrivateImage } from './PrivateImage';

const companySchema = z.object({
  companyName: z.string().trim().min(1, 'Enter a company name').max(120, 'Name must be 120 characters or fewer'),
  numberOfUsers: z.number({ invalid_type_error: 'Enter a whole number' }).int().min(0).max(10_000_000),
  numberOfProducts: z.number({ invalid_type_error: 'Enter a whole number' }).int().min(0).max(10_000_000)
});
type CompanyForm = z.infer<typeof companySchema>;

const emptyForm: CompanyForm = { companyName: '', numberOfUsers: 0, numberOfProducts: 0 };
const IMAGE_PAGE_SIZE = 20;

export function Workspace({ user, profile }: { user: User; profile: SessionProfile }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [images, setImages] = useState<CompanyImage[]>([]);
  const [imagePage, setImagePage] = useState(1);
  const [imageTotal, setImageTotal] = useState(0);
  const imagePageRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isOwner = profile.role === 'USER_A';
  const auth = getFirebaseAuth();
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: emptyForm
  });
  const watchedUsers = useWatch({ control, name: 'numberOfUsers' }) ?? 0;
  const watchedProducts = useWatch({ control, name: 'numberOfProducts' }) ?? 0;
  const preview = calculatePercentage(Number(watchedUsers), Number(watchedProducts));

  const refreshImages = useCallback(async (page = imagePageRef.current): Promise<void> => {
    const result = await apiRequest<PaginatedImages>(`/company/me/images?page=${page}&limit=${IMAGE_PAGE_SIZE}`);
    setImages(result.items);
    setImagePage(result.page);
    imagePageRef.current = result.page;
    setImageTotal(result.total);
  }, []);

  const refreshCompany = useCallback(async (): Promise<void> => {
    const latest = await apiRequest<Company>(isOwner ? '/company/me' : '/collaborator/company/latest');
    setCompany(latest);
    if (isOwner) {
      reset({
        companyName: latest.companyName,
        numberOfUsers: latest.numberOfUsers,
        numberOfProducts: latest.numberOfProducts
      });
    }
  }, [isOwner, reset]);

  function changeImagePage(page: number): void {
    setError('');
    void refreshImages(page).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not load this image page.');
    });
  }

  useEffect(() => {
    let active = true;
    void Promise.allSettled([refreshCompany(), refreshImages(1)]).then(([companyResult, imagesResult]) => {
      if (!active) return;
      if (companyResult.status === 'rejected' && !(companyResult.reason instanceof ApiRequestError && companyResult.reason.status === 404)) {
        setError(companyResult.reason instanceof Error ? companyResult.reason.message : 'Could not load company information.');
      }
      if (imagesResult.status === 'rejected') setError(imagesResult.reason instanceof Error ? imagesResult.reason.message : 'Could not load images.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [refreshCompany, refreshImages]);

  useEffect(() => {
    const socket: Socket = io(`${socketBase()}/collaboration`, {
      auth: (callback) => {
        void user.getIdToken().then((token) => callback({ token }))
          .catch(() => callback({}));
      },
      transports: ['websocket']
    });
    socket.on('connect', () => {
      const refreshCompanyIfSubmitted = refreshCompany().catch((caught: unknown) => {
        if (caught instanceof ApiRequestError && caught.status === 404) return;
        throw caught;
      });
      void Promise.all([refreshCompanyIfSubmitted, refreshImages()])
        .then(() => setError(''))
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not refresh workspace data.'));
    });
    socket.on('connect_error', () => setError('Live sync is unavailable. The workspace can still be refreshed manually.'));
    socket.on('company.updated', () => {
      void refreshCompany().then(() => setMessage('Company information is now in sync.'))
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not refresh company information.'));
    });
    socket.on('image.uploaded', () => {
      void refreshImages().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not refresh images.'));
    });
    return () => { socket.disconnect(); };
  }, [user, refreshCompany, refreshImages]);

  async function saveCompany(values: CompanyForm): Promise<void> {
    setError('');
    setMessage('');
    try {
      const saved = await apiRequest<Company>('/company/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
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
    setUploadProgress(0);
    setError('');
    setMessage('');
    try {
      await apiUpload<CompanyImage>('/company/me/images', data, setUploadProgress);
      await refreshImages(1);
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
        <Link className="brand" href="/" aria-label="Company Desk home">
          <span className="brand-mark">C</span><span>company<br />desk<span className="brand-period">.</span></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <div className="nav-current"><span className="nav-indicator" />Company overview</div>
        <div className="sidebar-bottom">
          <div className="profile-avatar" aria-hidden="true">{isOwner ? 'A' : 'B'}</div>
          <div className="profile-copy"><strong>{isOwner ? 'Data owner' : 'Collaborator'}</strong><span>{profile.email}</span></div>
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
            <div className="section-heading"><div><p className="eyebrow">01 / COMPANY DETAILS</p><h2 id="company-heading">Company profile</h2></div><span className="section-caption">{company ? `Updated ${new Date(company.updatedAt).toLocaleString()}` : 'Not submitted yet'}</span></div>
            {loading ? <div className="loading-line" role="status">Loading company information…</div> : isOwner ? (
              <form className="company-form" onSubmit={handleSubmit(saveCompany)}>
                <label className="field field-name"><span>Company name</span><input {...register('companyName')} placeholder="e.g. Northstar Labs" autoComplete="organization" aria-invalid={!!errors.companyName} />{errors.companyName && <small>{errors.companyName.message}</small>}</label>
                <label className="field"><span>Number of users</span><input type="number" inputMode="numeric" min="0" step="1" {...register('numberOfUsers', { valueAsNumber: true })} aria-invalid={!!errors.numberOfUsers} />{errors.numberOfUsers && <small>{errors.numberOfUsers.message}</small>}</label>
                <label className="field"><span>Number of products</span><input type="number" inputMode="numeric" min="0" step="1" {...register('numberOfProducts', { valueAsNumber: true })} aria-invalid={!!errors.numberOfProducts} />{errors.numberOfProducts && <small>{errors.numberOfProducts.message}</small>}</label>
                <div className="form-footer"><PercentagePreview value={preview} /><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : company ? 'Save changes' : 'Submit company'}</button></div>
              </form>
            ) : company ? (
              <div className="company-readonly">
                <div className="readonly-name"><span className="eyebrow">COMPANY</span><strong>{company.companyName}</strong></div>
                <div className="readonly-stat"><span>Users</span><strong>{company.numberOfUsers.toLocaleString()}</strong></div>
                <div className="readonly-stat"><span>Products</span><strong>{company.numberOfProducts.toLocaleString()}</strong></div>
                <PercentagePreview value={company.percentage} />
                {!isOwner && <button type="button" className="upload-button" onClick={() => {
                  setLoading(true);
                  void refreshCompany()
                    .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not refresh company information.'))
                    .finally(() => setLoading(false));
                }}>View latest inputs</button>}
              </div>
            ) : <div className="empty-company"><span className="empty-symbol">—</span><div><strong>Company details are on their way.</strong><p>The owner has not submitted a company profile yet.</p></div>{!isOwner && <button type="button" className="upload-button" onClick={() => {
              setLoading(true);
              void refreshCompany()
                .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not refresh company information.'))
                .finally(() => setLoading(false));
            }}>View latest inputs</button>}</div>}
          </section>

          <section className="images-section" aria-labelledby="images-heading">
            <div className="section-heading"><div><p className="eyebrow">02 / SHARED FILES</p><h2 id="images-heading">Company images <span className="count-pill">{imageTotal}</span></h2></div>{isOwner && <span className="section-caption">Uploaded by your collaborator</span>}</div>
            {profile.role === 'USER_B' && <form className="upload-row" onSubmit={uploadImage}>
              <label className="file-control"><span>Choose image</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a JPEG, PNG, or WebP image" /></label>
              <span className="upload-hint">JPEG, PNG, WebP · up to 5 MB</span>
              <button className="upload-button" type="submit" disabled={uploading || !company}>{uploading ? 'Uploading…' : 'Upload image'}</button>
              {uploading && <progress className="upload-progress" value={uploadProgress} max={100} aria-label={`Image upload ${uploadProgress}% complete`} />}
            </form>}
            {images.length ? <div className="image-grid">{images.map((image) => <PrivateImage key={image.id} image={image} />)}</div> : <div className="empty-images"><span className="empty-image-icon" aria-hidden="true">＋</span><div><strong>No images shared yet</strong><p>{isOwner ? 'Images uploaded by your collaborator will appear here.' : 'Add a company image to share it with the owner.'}</p></div></div>}
            {imageTotal > IMAGE_PAGE_SIZE && <nav className="image-pagination" aria-label="Image pages">
              <button type="button" className="upload-button" onClick={() => changeImagePage(imagePage - 1)} disabled={imagePage <= 1}>Previous</button>
              <span>Page {imagePage} of {Math.ceil(imageTotal / IMAGE_PAGE_SIZE)}</span>
              <button type="button" className="upload-button" onClick={() => changeImagePage(imagePage + 1)} disabled={imagePage >= Math.ceil(imageTotal / IMAGE_PAGE_SIZE)}>Next</button>
            </nav>}
          </section>

          <footer className="content-footer"><span>COMPANY DESK</span><span>Only your two authorized accounts can access this workspace.</span></footer>
        </div>
      </section>
    </main>
  );
}
