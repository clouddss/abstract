#!/bin/bash

# Abstract Pump Platform - Production Deployment Script
# This script helps deploy the platform to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Check for required files
check_requirements() {
    print_info "Checking requirements..."
    
    if [ ! -f ".env.production" ]; then
        print_error ".env.production file not found!"
        print_info "Please copy .env.production.example to .env.production and fill in the values"
        exit 1
    fi
    
    if [ ! -f "backend/.env" ]; then
        print_error "backend/.env file not found!"
        print_info "Please copy backend/.env.example to backend/.env and fill in the values"
        exit 1
    fi
    
    if [ ! -f "frontend/.env.local" ]; then
        print_error "frontend/.env.local file not found!"
        print_info "Please copy frontend/.env.example to frontend/.env.local and fill in the values"
        exit 1
    fi
    
    print_success "All required files present"
}

# Install Docker if not present
install_docker() {
    if ! command -v docker &> /dev/null; then
        print_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        print_success "Docker installed"
    else
        print_success "Docker already installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_info "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose installed"
    else
        print_success "Docker Compose already installed"
    fi
}

# Setup SSL certificates
setup_ssl() {
    print_info "Setting up SSL certificates..."
    
    # Load environment variables
    source .env.production
    
    # Create required directories
    mkdir -p certbot/conf
    mkdir -p certbot/www
    
    # Check if certificates already exist
    if [ -d "certbot/conf/live/$DOMAIN" ] && [ -d "certbot/conf/live/$API_DOMAIN" ]; then
        print_success "SSL certificates already exist"
        return
    fi
    
    # Start nginx for domain verification
    docker-compose -f docker-compose.production.yml up -d nginx
    
    # Get certificates
    print_info "Obtaining SSL certificate for $DOMAIN..."
    docker-compose -f docker-compose.production.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $SSL_EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    print_info "Obtaining SSL certificate for $API_DOMAIN..."
    docker-compose -f docker-compose.production.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $SSL_EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $API_DOMAIN
    
    print_success "SSL certificates obtained"
}

# Deploy application
deploy() {
    print_info "Deploying Abstract Pump Platform..."
    
    # Build images
    print_info "Building Docker images..."
    docker-compose -f docker-compose.production.yml build
    
    # Run database migrations
    print_info "Running database migrations..."
    docker-compose -f docker-compose.production.yml run --rm backend npm run migrate
    
    # Start services
    print_info "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be healthy
    print_info "Waiting for services to be healthy..."
    sleep 10
    
    # Check service health
    if docker-compose -f docker-compose.production.yml ps | grep -q "unhealthy"; then
        print_error "Some services are unhealthy!"
        docker-compose -f docker-compose.production.yml ps
        exit 1
    fi
    
    print_success "Deployment complete!"
}

# Show status
show_status() {
    print_info "Service Status:"
    docker-compose -f docker-compose.production.yml ps
    
    print_info "\nContainer Logs (last 20 lines):"
    docker-compose -f docker-compose.production.yml logs --tail=20
}

# Main menu
main() {
    echo "Abstract Pump Platform - Deployment Script"
    echo "=========================================="
    echo ""
    echo "What would you like to do?"
    echo "1. Full deployment (new installation)"
    echo "2. Update deployment (existing installation)"
    echo "3. Setup SSL certificates only"
    echo "4. Show service status"
    echo "5. Stop all services"
    echo "6. Exit"
    echo ""
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            check_requirements
            install_docker
            setup_ssl
            deploy
            show_status
            ;;
        2)
            check_requirements
            print_info "Pulling latest changes..."
            git pull
            print_info "Rebuilding and redeploying..."
            docker-compose -f docker-compose.production.yml build
            docker-compose -f docker-compose.production.yml up -d
            print_success "Update complete!"
            show_status
            ;;
        3)
            setup_ssl
            ;;
        4)
            show_status
            ;;
        5)
            print_warning "Stopping all services..."
            docker-compose -f docker-compose.production.yml down
            print_success "All services stopped"
            ;;
        6)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice!"
            exit 1
            ;;
    esac
}

# Run main function
main