# Prince Express – Courier & Logistics Management System

A full-stack courier and logistics management platform built to manage the complete shipment lifecycle — from customer booking and rate calculation to shipment processing, courier integrations, tracking, label generation, and delivery operations.

## 🚀 Overview

**Prince Express Dashboard** is an end-to-end courier management system developed for **Prince Express**.

The platform connects a React-based frontend with a Node.js/Express REST API and MySQL database, while integrating external courier services for shipment booking and tracking.

### Core Capabilities

* Customer and admin shipment booking
* Courier rate calculation
* Shipment management
* Third-party courier API integration
* Shipment tracking and synchronization
* Customer management
* Product and shipment item management
* Shipping label and invoice generation
* Barcode generation
* Role-based user management
* Analytics and reporting
* Bulk rate and shipment import/export

## ✨ Features

### 📦 Shipment & Booking Management

* Create and manage courier bookings
* Customer self-service booking
* Admin booking approval workflow
* Manage shipment items and manifests
* Calculate shipment pieces and weight
* Manage shipment status and history
* Generate shipping documents

### 💰 Rate Calculation

Implemented a configurable **zone-based rate calculation engine** supporting:

* Destination zones
* Weight brackets
* Courier/service selection
* Configurable pricing
* Bulk rate import/export

### 🚚 Courier Integrations

The backend uses a modular courier adapter architecture to integrate multiple external courier providers.

```text
Application
     ↓
Courier Adapter
     ↓
External Courier API
     ↓
Booking / AWB / Tracking Response
```

The adapter layer normalizes different courier APIs into a consistent application format.

### 📍 Shipment Tracking

* Track shipments using AWB numbers
* Integrate external courier tracking APIs
* Synchronize tracking information
* Maintain shipment tracking history
* Display current shipment status
* Background tracking synchronization

### 🧾 Document & Barcode Generation

The system automatically generates:

* Shipping labels
* Waybills
* Invoices
* Barcodes

Technologies used:

* **PDFKit** for PDF document generation
* **bwip-js** for barcode generation

### 👥 User & Role Management

The system supports role-based access for different users and operational workflows.

```text
Admin
 ├── Bookings
 ├── Customers
 ├── Products
 ├── Rates
 ├── Tracking
 ├── Couriers
 ├── Users
 └── Analytics

Customer
 ├── Create Booking
 ├── View Shipments
 └── Track Shipment
```

### 📊 Dashboard & Analytics

The React dashboard provides operational insights including:

* Shipment statistics
* Booking metrics
* Shipment status
* Customer data
* Courier performance
* Revenue and operational metrics

Charts and visualizations are implemented using **Recharts**.

### 📥 Data Import & Export

Supports bulk data operations for:

* Courier rates
* Shipment data
* Operational records

Excel processing is handled using the **XLSX** library.

## 🏗️ System Architecture

```text
                   ┌──────────────────────────┐
                   │   WordPress Website      │
                   │   Customer Bookings      │
                   └────────────┬─────────────┘
                                │
                                │ REST API
                                ▼
┌───────────────────┐     ┌──────────────────────┐
│   React Frontend  │────▶│ Node.js + Express    │
│                   │ REST│ REST API             │
│ Admin Dashboard   │     │                      │
│ Customer Portal   │     │ Auth                 │
│ Tracking          │     │ Bookings             │
│ Rates             │     │ Tracking             │
│ Analytics         │     │ Rates                │
└───────────────────┘     │ Couriers             │
                          └──────────┬───────────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │                           │
                       ▼                           ▼
                ┌─────────────┐            ┌──────────────┐
                │    MySQL    │            │   Courier    │
                │   Database  │            │     APIs     │
                └─────────────┘            └──────────────┘
```

## 🛠️ Tech Stack

### Frontend

* React 19
* Vite
* JavaScript
* Tailwind CSS
* TanStack React Query
* Zustand
* Recharts

### Backend

* Node.js
* Express 5
* REST APIs
* PDFKit
* bwip-js
* XLSX

### Database

* MySQL

### Integrations

* Third-party Courier APIs
* Shipment Tracking APIs
* WordPress API integrations

### Development Tools

* Git
* GitHub
* VS Code
* Postman
* Chrome DevTools

## 📁 Project Structure

```text
courier-admin/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── ...
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── bookings/
│   │   │   ├── bookingRequests/
│   │   │   ├── customer/
│   │   │   ├── rates/
│   │   │   ├── tracking/
│   │   │   ├── couriers/
│   │   │   ├── auth/
│   │   │   └── users/
│   │   │
│   │   ├── courierAdapters/
│   │   ├── services/
│   │   └── ...
│   │
│   └── package.json
│
└── README.md
```

## 🔄 Shipment Workflow

```text
Customer Creates Booking
          ↓
      Rate Calculation
          ↓
     Booking Approval
          ↓
     Shipment Creation
          ↓
 Courier API Integration
          ↓
      AWB Generation
          ↓
 Label / Invoice Generation
          ↓
      Shipment Pickup
          ↓
   Tracking Synchronization
          ↓
     In Transit
          ↓
       Delivered
```

## 🔐 API Architecture

The backend follows a modular REST API architecture.

Example modules:

```text
/auth
/bookings
/booking-requests
/customers
/products
/rates
/tracking
/couriers
/users
```

This modular structure makes it easier to add new functionality and integrate additional courier providers without affecting existing modules.

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd courier-admin
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../backend
npm install
```

### 4. Configure environment variables

Create the required `.env` files for the frontend and backend.

Example:

```env
PORT=5000

DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

API_BASE_URL=http://localhost:5000
```

Add courier API credentials and other integration settings according to your environment.

### 5. Start the backend

```bash
cd backend
npm run dev
```

### 6. Start the frontend

```bash
cd frontend
npm run dev
```

## 🧪 API Testing

REST APIs can be tested using **Postman** or similar API testing tools.

Typical workflow:

```text
Request
   ↓
Express Route
   ↓
Controller / Service
   ↓
Database / External API
   ↓
JSON Response
```

## 🎯 Key Highlights

* Full-stack **React + Node.js + Express + MySQL** application
* Modular REST API architecture
* Multi-courier API integration
* Automated shipment tracking synchronization
* Zone and weight-based rate engine
* Automated PDF label and invoice generation
* Barcode generation
* Role-based access control
* Customer booking workflow
* Bulk Excel import/export
* Responsive React dashboard
* Git-based development workflow


## 📌 Project Status

**Status:** Completed / Actively Maintained

## 👨‍💻 Author

**Suraj Sabu**

Web Developer

* GitHub: https://github.com/suraj-2807
* LinkedIn: https://www.linkedin.com/in/suraj-sabu-b4b40a229/
