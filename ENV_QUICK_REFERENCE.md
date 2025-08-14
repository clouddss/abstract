# Environment Files Quick Reference

## File Structure

```
Abstract/
├── frontend/
│   ├── .env.local          # Local development (use this locally)
│   ├── .env.production     # Production template (copy & modify for server)
│   └── .env.example        # Example template (for reference)
│
└── backend/
    ├── .env                # Minimal defaults (safe)
    ├── .env.local          # Local development (use this locally)
    ├── .env.production     # Production template (copy & modify for server)
    └── .env.example        # Detailed example (for reference)
```

## Quick Setup Commands

### Local Development
```bash
# Backend
cd backend
cp .env.local .env
# Edit .env - update DATABASE_URL password

# Frontend  
cd frontend
# Already configured - just run
npm run dev
```

### Production Server
```bash
# Backend
cd backend
cp .env.production .env
# Edit .env - update all production values

# Frontend
cd frontend
cp .env.production .env.local
# Edit .env.local - update API URL to your domain
```

## Key Values to Update

### 🔴 Critical Security (Backend Production)
```bash
# Generate these values - DO NOT use defaults!
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
ADMIN_API_KEYS=$(openssl rand -hex 32)
```

### 📝 Contract Addresses (Both Frontend & Backend)
After deploying contracts, update:
- `LAUNCH_FACTORY_ADDRESS`
- `PLATFORM_ROUTER_ADDRESS`
- `REWARDS_VAULT_ADDRESS`

### 🌐 Production URLs (Frontend)
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

### 🔧 Production Database (Backend)
```
DATABASE_URL=postgresql://abstract_user:STRONG_PASSWORD@localhost:5432/abstract_pump
```

## Security Reminders

⚠️ **NEVER**:
- Commit `.env.local` or `.env.production` files
- Share private keys or secrets
- Use default secrets in production
- Expose backend env vars to frontend

✅ **ALWAYS**:
- Generate new secrets for production
- Use HTTPS in production
- Keep sensitive data in backend only
- Update contract addresses after deployment