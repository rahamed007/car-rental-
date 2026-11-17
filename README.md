# DriveEase Car Rental System
**Student:** Al Rayain Ahmed (ID: 4553)  
**Batch/Section:** CSE 69 C  
**Course:** Web Technology & Programming  
**Course Teacher:** Kh. Mustafizur Rahman (Senior Lecturer, Dept. of CSE)  

## How to Run Locally
1. Make sure **Node.js** and **MongoDB** are installed and MongoDB service is running (`mongodb://127.0.0.1:27017`).
2. Open a terminal inside this folder and install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser and visit: `http://localhost:3000`
5. **Admin Account Setup:** Register the first user on `/register` — the first account is automatically assigned the `admin` role. Register a second account to test the normal `user` (customer) booking workflow.

## Deploy to Vercel
1. Create a MongoDB Atlas cluster and copy the connection string.
2. In Vercel, add these environment variables:
   ```bash
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
   SESSION_SECRET=your-strong-random-secret
   NODE_ENV=production
   ```
3. Import the GitHub repo into Vercel and deploy it.
4. Vercel will run the app using the `server.js` entry point and the included `vercel.json` configuration.
5. After deployment, visit the Vercel URL and register the first account to create the admin user.
