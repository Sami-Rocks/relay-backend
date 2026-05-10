# Style Mart Backend

A robust e-commerce backend API built with Node.js, Express, and Prisma, featuring multi-shop support, user authentication, and order management.

## Features

- 🔐 JWT-based authentication
- 🏪 Multi-shop support
- 📦 Product management
- 🛒 Order processing
- 🔍 Advanced querying and filtering
- 🔄 Real-time database updates

## Tech Stack

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JSON Web Tokens (JWT)
- bcryptjs for password hashing

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd sm-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create a .env file and add:
DATABASE_URL="postgresql://username:password@localhost:5432/style_mart"
JWT_SECRET="your-secure-jwt-secret"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

4. Initialize the database:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication

#### Register User
- **POST** `/api/users/register`
- **Body**: `{ "email": "user@example.com", "password": "password123" }`
- **Response**: `{ "message": "User created successfully", "token": "jwt-token" }`

#### Login
- **POST** `/api/users/login`
- **Body**: `{ "email": "user@example.com", "password": "password123" }`
- **Response**: `{ "token": "jwt-token" }`

### User Management

#### Get Profile
- **GET** `/api/users/profile`
- **Auth**: Required
- **Response**: User profile data

#### Update Profile
- **PUT** `/api/users/profile`
- **Auth**: Required
- **Body**: `{ "email": "new@example.com", "password": "newpassword" }`
- **Response**: Updated user data

#### Delete Account
- **DELETE** `/api/users/account`
- **Auth**: Required
- **Response**: Success message

### Shop Management

#### Get All Shops
- **GET** `/api/shops`
- **Auth**: Not required
- **Response**: List of all shops with their products

#### Get Single Shop
- **GET** `/api/shops/:id`
- **Auth**: Not required
- **Response**: Shop details with products

#### Get User's Shops
- **GET** `/api/shops/user/shops`
- **Auth**: Required
- **Response**: List of shops owned by the user

#### Create Shop
- **POST** `/api/shops`
- **Auth**: Required
- **Body**: `{ "name": "My Shop", "description": "Shop description" }`
- **Response**: Created shop data

#### Update Shop
- **PUT** `/api/shops/:id`
- **Auth**: Required
- **Body**: `{ "name": "Updated Name", "description": "Updated description" }`
- **Response**: Updated shop data

#### Upload Shop Image
- **POST** `/api/shops/:id/image`
- **Auth**: Required
- **Body**: `multipart/form-data` with image field named `image`
- **Allowed**: JPEG, PNG, WEBP up to 5MB
- **Response**: Updated shop data

#### Delete Shop Image
- **DELETE** `/api/shops/:id/image`
- **Auth**: Required
- **Response**: Updated shop data

#### Delete Shop
- **DELETE** `/api/shops/:id`
- **Auth**: Required
- **Response**: Success message

### Product Management

#### Get All Products
- **GET** `/api/products`
- **Auth**: Not required
- **Response**: List of all products with shop info

#### Get Single Product
- **GET** `/api/products/:id`
- **Auth**: Not required
- **Response**: Product details with shop info

#### Create Product
- **POST** `/api/products`
- **Auth**: Required
- **Body**: `{ "name": "Product Name", "description": "Description", "price": 29.99, "shopId": 1 }`
- **Response**: Created product data

#### Update Product
- **PUT** `/api/products/:id`
- **Auth**: Required
- **Body**: `{ "name": "Updated Name", "description": "Updated description", "price": 39.99 }`
- **Response**: Updated product data

#### Upload Product Image
- **POST** `/api/products/:id/image`
- **Auth**: Required
- **Body**: `multipart/form-data` with image field named `image`
- **Allowed**: JPEG, PNG, WEBP up to 5MB
- **Response**: Updated product data

#### Delete Product Image
- **DELETE** `/api/products/:id/image`
- **Auth**: Required
- **Response**: Updated product data

#### Delete Product
- **DELETE** `/api/products/:id`
- **Auth**: Required
- **Response**: Success message

### Order Management

#### Create Order
- **POST** `/api/orders`
- **Auth**: Required
- **Body**: `{ "shopId": 1, "total": 59.98, "productIds": [1, 2] }`
- **Response**: Created order data

#### Get User Orders
- **GET** `/api/orders/user`
- **Auth**: Required
- **Response**: List of user's orders

#### Get Shop Orders
- **GET** `/api/orders/shop/:shopId`
- **Auth**: Required (Shop owner only)
- **Response**: List of orders for the shop

#### Get Single Order
- **GET** `/api/orders/:id`
- **Auth**: Required (Order owner or shop owner)
- **Response**: Order details

#### Update Order
- **PUT** `/api/orders/:id`
- **Auth**: Required (Shop owner only)
- **Body**: `{ "total": 79.98, "productIds": [1, 2, 3] }`
- **Response**: Updated order data

#### Delete Order
- **DELETE** `/api/orders/:id`
- **Auth**: Required (Shop owner only)
- **Response**: Success message

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `200`: Success
- `201`: Resource created
- `400`: Bad request
- `401`: Unauthorized
- `404`: Resource not found
- `500`: Server error

## Database Schema

### User
- id (Int, auto-increment)
- email (String, unique)
- password (String, hashed)
- createdAt (DateTime)
- updatedAt (DateTime)
- Relations: orders, shops

### Shop
- id (Int, auto-increment)
- name (String)
- description (String, optional)
- userId (Int)
- createdAt (DateTime)
- updatedAt (DateTime)
- Relations: user, products, orders

### Product
- id (Int, auto-increment)
- name (String)
- description (String, optional)
- price (Float)
- shopId (Int)
- createdAt (DateTime)
- updatedAt (DateTime)
- Relations: shop, orders

### Order
- id (Int, auto-increment)
- userId (Int)
- shopId (Int)
- total (Float)
- createdAt (DateTime)
- updatedAt (DateTime)
- Relations: user, shop, products

## License

This project is licensed under the MIT License.
