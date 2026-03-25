#!/bin/bash

# Script di Deploy su Google Cloud Run
# Utilizzo: ./deploy-cloud-run.sh <project-id> <region>

set -e

PROJECT_ID=${1:-"maintenance-pro-demo"}
REGION=${2:-"europe-west1"}
SERVICE_NAME="maintenance-pro"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Maintenance Pro V4..."
echo "📦 Project: $PROJECT_ID"
echo "🌍 Region: $REGION"
echo ""

# Verifica gcloud
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI non trovato. Installa Google Cloud SDK"
    exit 1
fi

# Build dell'immagine Docker
echo "🔨 Building Docker image..."
gcloud builds submit --tag $IMAGE_NAME --project=$PROJECT_ID || {
    echo "❌ Build fallito"
    exit 1
}

# Deploy su Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --project=$PROJECT_ID \
    --region=$REGION \
    --platform=managed \
    --memory=512Mi \
    --cpu=1 \
    --timeout=3600 \
    --max-instances=100 \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production" \
    || {
        echo "❌ Deploy fallito"
        exit 1
    }

# Ottieni l'URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --platform=managed \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format='value(status.url)')

echo ""
echo "✅ Deployment completato!"
echo ""
echo "📍 URL dell'app: $SERVICE_URL"
echo ""
echo "🔑 Credenziali default:"
echo "   Email: admin@maintenance.pro"
echo "   Password: admin"
echo ""
echo "⚠️  IMPORTANTE: Cambia le credenziali di default al primo accesso!"
echo ""
echo "🔧 Configura le variabili di ambiente:"
echo "   gcloud run services update $SERVICE_NAME --region=$REGION --update-env-vars JWT_SECRET=your-secret-key"
