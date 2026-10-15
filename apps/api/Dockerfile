FROM node:20-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci
RUN npm run db:generate --workspace @company-platform/api
COPY apps/api apps/api
RUN npm run build --workspace @company-platform/api

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci --omit=dev
COPY --from=build /workspace/apps/api/dist apps/api/dist
COPY --from=build /workspace/node_modules/.prisma node_modules/.prisma
EXPOSE 4000
CMD ["npm", "--workspace", "@company-platform/api", "run", "start"]
