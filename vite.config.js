import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const certDir = path.resolve(__dirname, '.certs')
const hasCerts = fs.existsSync(path.join(certDir, 'dev-key.pem')) && fs.existsSync(path.join(certDir, 'dev-cert.pem'))

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https: hasCerts
      ? {
          key: fs.readFileSync(path.join(certDir, 'dev-key.pem')),
          cert: fs.readFileSync(path.join(certDir, 'dev-cert.pem')),
        }
      : undefined,
  },
})
