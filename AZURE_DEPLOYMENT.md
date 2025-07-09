# Azure Web App Deployment Guide

This guide will help you deploy your SupportSphere chat widget to Azure Web App.

## Prerequisites

1. **Azure Account**: Active Azure subscription
2. **Azure CLI**: Install Azure CLI for deployment
3. **Git**: For source control integration

## Deployment Steps

### 1. Create Azure Web App

```bash
# Login to Azure
az login

# Create resource group (if not exists)
az group create --name SupportSphere-RG --location "East US"

# Create App Service Plan
az appservice plan create --name SupportSphere-Plan --resource-group SupportSphere-RG --sku B1 --is-linux

# Create Web App
az webapp create --name your-app-name --resource-group SupportSphere-RG --plan SupportSphere-Plan --runtime "NODE|18-lts"
```

### 2. Configure Environment Variables

In Azure Portal or via CLI:

```bash
# Set environment variables
az webapp config appsettings set --name your-app-name --resource-group SupportSphere-RG --settings \
  NODE_ENV=production \
  ALLOWED_ORIGINS="https://your-app-name.azurewebsites.net,https://your-domain.com" \
  PYTHON_PATH="/usr/bin/python3"
```

### 3. Enable Python Support

```bash
# Enable Python support
az webapp config set --name your-app-name --resource-group SupportSphere-RG --linux-fx-version "NODE|18-lts"
```

### 4. Deploy Your Code

#### Option A: Git Deployment
```bash
# Add Azure remote
git remote add azure https://your-app-name.scm.azurewebsites.net:443/your-app-name.git

# Deploy
git push azure main
```

#### Option B: ZIP Deployment
```bash
# Build locally
npm run build

# Create deployment package
zip -r deployment.zip . -x "node_modules/*" ".git/*" "*.log"

# Deploy
az webapp deployment source config-zip --name your-app-name --resource-group SupportSphere-RG --src deployment.zip
```

### 5. Configure Custom Domain (Optional)

```bash
# Add custom domain
az webapp config hostname add --webapp-name your-app-name --resource-group SupportSphere-RG --hostname your-domain.com
```

## Configuration Files

### web.config
- Handles URL rewriting for Azure IIS
- Routes API calls to Node.js
- Serves static files directly

### startup.txt
- Tells Azure how to start the application
- Uses `npm start` command

### azure-deploy.sh
- Sets up Python environment
- Creates necessary directories
- Configures permissions

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `8080` (auto-set by Azure) |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://your-app.azurewebsites.net` |
| `PYTHON_PATH` | Python executable path | `/usr/bin/python3` |
| `DATABASE_URL` | Database connection (if using) | `postgresql://...` |

## Testing Your Deployment

1. **Health Check**: Visit `https://your-app-name.azurewebsites.net/api/health`
2. **Widget Demo**: Visit `https://your-app-name.azurewebsites.net/widget`
3. **Test Page**: Visit `https://your-app-name.azurewebsites.net/test`

## Troubleshooting

### Common Issues

1. **Python Not Found**
   - Ensure `PYTHON_PATH` is set correctly
   - Check if Python is installed in Azure environment

2. **CORS Errors**
   - Update `ALLOWED_ORIGINS` with your domain
   - Check browser console for CORS policy violations

3. **Build Failures**
   - Check Azure deployment logs
   - Ensure all dependencies are in `package.json`

4. **File Upload Issues**
   - Verify `uploads` directory exists
   - Check file permissions

### Logs and Monitoring

```bash
# View application logs
az webapp log tail --name your-app-name --resource-group SupportSphere-RG

# Download logs
az webapp log download --name your-app-name --resource-group SupportSphere-RG
```

## Performance Optimization

1. **Enable CDN**: Use Azure CDN for static assets
2. **Database**: Consider Azure Database for PostgreSQL
3. **Caching**: Implement Redis for session storage
4. **Scaling**: Configure auto-scaling rules

## Security Considerations

1. **HTTPS**: Azure provides SSL certificates
2. **CORS**: Restrict allowed origins
3. **Rate Limiting**: Already implemented in the app
4. **File Uploads**: Validate file types and sizes

## Support

For Azure-specific issues:
- Azure Documentation: https://docs.microsoft.com/azure/app-service/
- Azure Support: https://azure.microsoft.com/support/

For application-specific issues:
- Check the application logs
- Review the troubleshooting section above 