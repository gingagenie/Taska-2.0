# Replit.md

## Overview

Taska is a comprehensive field service management application designed for service businesses. It provides tools to manage jobs, customers, equipment, teams, quotes, and invoices through a responsive web interface. The project aims to deliver an intuitive solution for streamlining field service operations.

## Recent Changes (August 2025)

**Xero Integration - Production Ready:**
- Complete OAuth2 integration with Xero accounting software
- New "Integrations" tab in Settings page for managing connections
- "Create in Xero" functionality for quotes and invoices (one-way push)
- Automatic creation of quotes and invoices in Xero as drafts
- Secure token storage and automatic refresh mechanism
- Mobile-responsive settings interface with proper tab layout
- Graceful error handling and user feedback system
- Ready for production deployment with environment variable configuration

**Bidirectional SMS Confirmation System - Production Ready:**
- Integrated Twilio SMS service for automated job confirmation messages to customers
- Added "Send SMS" button on job view pages with customizable message preview
- Implemented automatic Australian phone number formatting (+61 country code)
- Customer phone numbers auto-populate from database records
- Timezone-aware message formatting using Australia/Melbourne time
- **NEW: SMS Reply Processing** - Customers can reply "YES" or "Y" to automatically confirm jobs
- **NEW: Webhook Handler** - `/api/twilio/webhook/sms` processes inbound SMS replies
- **NEW: Job Status Updates** - Automatic status change to "confirmed" with visual indicators
- **NEW: SMS Logging** - Complete audit trail in `job_notifications` table
- Complete bidirectional SMS workflow: outbound notification → customer reply → automatic confirmation
- **PRODUCTION DEPLOYMENT SUCCESS**: Fixed Twilio webhook URL configuration issue
- Feature fully tested and working in production (August 2025)
- Complete workflow confirmed: SMS sent → customer replies "YES" → job automatically confirmed with ✓ badge

**Clickable Cards UX Enhancement - Deployed:**
- Replaced separate "View" buttons with intuitive clickable card interfaces across Jobs, Customers, and Equipment pages
- Cards now have hover effects and visual feedback with "Click for details →" indicators
- Navigation works seamlessly between list views and detail pages
- Enhanced user experience with more modern, touch-friendly interface design
- Feature successfully deployed to production and working correctly

**Timezone Bug - Known Issue:**
- Database uses `timestamptz` column type for proper timezone-aware storage
- Backend timezone conversion confirmed working via debug endpoints  
- Multiple frontend conversion attempts made but displays still showing UTC times
- Issue affects job scheduling displays across mobile schedule, desktop schedule, and datetime inputs
- Backend stores and converts times correctly, frontend display conversion needs further investigation

**Production Deployment Success:**
- Successfully deployed to production after resolving FK constraint conflicts
- Implemented bulletproof safety measures with session-only authentication in production
- Added double-validation for org existence at both middleware and endpoint levels
- Enhanced logging for 400/401 errors with org/user ID tracking for monitoring

**Production Environment Separation:**
- Created debug endpoint `/api/debug/env` for environment verification
- Proper development vs production configuration separation
- Session-based authentication in production, header-based auth in development
- Environment-specific CORS and cookie configurations
- Complete production setup guide (PRODUCTION_ENV_SETUP.md)

**Production Ready Features:**
- Job assignments table with FK constraints (PRODUCTION_JOB_ASSIGNMENTS.sql)
- Mobile schedule timezone fix for Australia/Melbourne filtering
- Authentication system compatible with both development and production
- All database migrations tested and verified as idempotent

**Database Schema & Safety:**
- Removed problematic FK constraint that caused deployment loops, replaced with application-level validation
- Production uses NOT VALID FK constraint approach for zero-downtime data integrity
- Added comprehensive cleanup scripts for production database hygiene
- Session-based authentication in production, header-based auth only for development

**Mobile Schedule Timezone Fix:**
- Implemented timezone-aware schedule endpoint supporting Australia/Melbourne timezone
- Fixed mobile schedule blank issue caused by UTC vs local time mismatch
- Mobile app now requests jobs filtered by Australian local time
- Server converts timestamps to specified timezone before date filtering
- Desktop schedule continues working unchanged

**Equipment-Customer Relationship Feature:**
- Added `equipment.customer_id` foreign key relationship to customers table
- Created equipment filtering API endpoint `/api/jobs/equipment?customerId=uuid`
- Enhanced job creation modal to filter equipment by selected customer
- Equipment dropdown disabled until customer is selected to prevent cross-customer equipment assignments
- Equipment creation/editing forms support customer assignment
- Complete customer-equipment relationship system working in development

**Customer Notes Feature:**
- Added `notes` text field to customers table with safe migration
- Enhanced customer modal UI with notes textarea input
- Added notes display in customer cards and search functionality
- Complete CRUD operations for customer notes working in development and production

**Job Assignments Feature:**
- Created `job_assignments` table with proper FK constraints to jobs and users tables
- Implemented technician assignment workflow for job creation and scheduling
- Enhanced schedule API to display assigned technicians with job details
- Fixed timezone-aware filtering to work with job assignment queries
- Complete CRUD operations for job-technician relationships working in development and production

**Technology Stack:**
- **Frontend**: React 18 + TypeScript + Tailwind CSS (responsive web)
- **Backend**: Express.js + TypeScript with RESTful API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with email/password login
- **Mobile Support**: Responsive web design optimized for mobile browsers

## User Preferences

Preferred communication style: Simple, everyday language.
Development workflow: Check all changes on preview screen first, then deploy to production once verified working.
Deployment preference: All changes should go to production after preview verification.

## System Architecture

### Frontend Architecture
The client is built using React 18 with TypeScript and a component-based architecture. It uses Wouter for routing, React Query for server state management, and Tailwind CSS with Shadcn/ui for styling. Vite is used for builds.

### Backend Architecture
The server uses Express.js with TypeScript, following a RESTful API pattern. It includes multi-tenancy for organization-based data isolation and comprehensive error handling. Authentication supports both session-based and header-based methods for development convenience.

### Data Storage
PostgreSQL is used as the database, managed with Drizzle ORM for type-safe operations. Neon Database provides serverless PostgreSQL hosting, and Drizzle Kit is used for migrations.

### Authentication and Authorization
The system employs session-based authentication with email/password login and bcrypt hashing. Sessions are securely stored in PostgreSQL using `connect-pg-simple` and are organization-scoped for multi-tenancy. Role-based access control is implemented, supporting both session and header authentication for flexibility.

### Component Design System
The application leverages the Shadcn/ui component library, built on Radix UI primitives and styled with Tailwind CSS. It uses CSS custom properties for theming, including dark mode support, and features a responsive, mobile-first design.

## External Dependencies

- **React 18**: Frontend framework
- **TypeScript**: Type safety across the stack
- **Express.js**: Backend web framework
- **Drizzle ORM**: Type-safe database toolkit
- **Vite**: Build tool and development server
- **PostgreSQL**: Primary database
- **Neon Database**: Serverless PostgreSQL hosting
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Component library
- **Radix UI**: Headless component primitives
- **Lucide React**: Icon library
- **React Hook Form**: Form handling
- **TanStack React Query**: Server state management and caching
- **Wouter**: Client-side routing
- **Zod**: Runtime type validation
- **connect-pg-simple**: PostgreSQL session store
- **bcrypt**: Password hashing