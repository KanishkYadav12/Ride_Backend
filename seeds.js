const mongoose = require("mongoose");
const dotenv = require("dotenv");
const userModel = require("./models/user.model");
const captainModel = require("./models/captain.model");
const bcrypt = require("bcrypt");

dotenv.config();

// ========================================
// SAMPLE USERS
// ========================================
const sampleUsers = [
  {
    fullname: {
      firstname: "Rahul",
      lastname: "Sharma",
    },
    email: "rahul@example.com",
    password: "password123",
  },
  {
    fullname: {
      firstname: "Priya",
      lastname: "Patel",
    },
    email: "priya@example.com",
    password: "password123",
  },
  {
    fullname: {
      firstname: "Amit",
      lastname: "Kumar",
    },
    email: "amit@example.com",
    password: "password123",
  },
  {
    fullname: {
      firstname: "Sneha",
      lastname: "Gupta",
    },
    email: "sneha@example.com",
    password: "password123",
  },
  {
    fullname: {
      firstname: "Rohan",
      lastname: "Singh",
    },
    email: "rohan@example.com",
    password: "password123",
  },
];

// ========================================
// SAMPLE CAPTAINS (Bhopal, Madhya Pradesh)
// ========================================
const sampleCaptains = [
  // Car Drivers
  {
    fullname: {
      firstname: "Vikram",
      lastname: "Singh",
    },
    email: "vikram@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Black",
      plate: "MP09AB1234",
      capacity: 4,
      vehicleType: "car",
    },
    location: {
      type: "Point",
      coordinates: [77.4126, 23.2599], // New Market Area, Bhopal
    },
  },
  {
    fullname: {
      firstname: "Rajesh",
      lastname: "Verma",
    },
    email: "rajesh@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "White",
      plate: "MP09CD5678",
      capacity: 4,
      vehicleType: "car",
    },
    location: {
      type: "Point",
      coordinates: [77.4304, 23.2156], // DB City Mall Area
    },
  },
  {
    fullname: {
      firstname: "Anil",
      lastname: "Sharma",
    },
    email: "anil@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Silver",
      plate: "MP09EF9012",
      capacity: 4,
      vehicleType: "car",
    },
    location: {
      type: "Point",
      coordinates: [77.4028, 23.2636], // Railway Station Area
    },
  },
  {
    fullname: {
      firstname: "Manoj",
      lastname: "Patel",
    },
    email: "manoj@captain.com",
    password: "password123",
    status: "inactive",
    vehicle: {
      color: "Blue",
      plate: "MP09GH3456",
      capacity: 4,
      vehicleType: "car",
    },
    location: {
      type: "Point",
      coordinates: [77.41, 23.23], // BHEL Area
    },
  },

  // Auto Drivers
  {
    fullname: {
      firstname: "Suresh",
      lastname: "Gupta",
    },
    email: "suresh@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Yellow",
      plate: "MP09IJ7890",
      capacity: 3,
      vehicleType: "auto",
    },
    location: {
      type: "Point",
      coordinates: [77.4417, 23.1815], // MP Nagar Area
    },
  },
  {
    fullname: {
      firstname: "Ramesh",
      lastname: "Yadav",
    },
    email: "ramesh@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Green",
      plate: "MP09KL1234",
      capacity: 3,
      vehicleType: "auto",
    },
    location: {
      type: "Point",
      coordinates: [77.391, 23.252], // Habibganj Area
    },
  },
  {
    fullname: {
      firstname: "Dinesh",
      lastname: "Jain",
    },
    email: "dinesh@captain.com",
    password: "password123",
    status: "inactive",
    vehicle: {
      color: "Yellow",
      plate: "MP09MN5678",
      capacity: 3,
      vehicleType: "auto",
    },
    location: {
      type: "Point",
      coordinates: [77.425, 23.24], // Bittan Market
    },
  },

  // Motorcycle Drivers
  {
    fullname: {
      firstname: "Arjun",
      lastname: "Reddy",
    },
    email: "arjun@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Red",
      plate: "MP09OP9012",
      capacity: 1,
      vehicleType: "motorcycle",
    },
    location: {
      type: "Point",
      coordinates: [77.403, 23.247], // Arera Colony
    },
  },
  {
    fullname: {
      firstname: "Karan",
      lastname: "Mehta",
    },
    email: "karan@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Black",
      plate: "MP09QR3456",
      capacity: 1,
      vehicleType: "motorcycle",
    },
    location: {
      type: "Point",
      coordinates: [77.45, 23.2], // Kolar Road
    },
  },
  {
    fullname: {
      firstname: "Sanjay",
      lastname: "Pandey",
    },
    email: "sanjay@captain.com",
    password: "password123",
    status: "active",
    vehicle: {
      color: "Blue",
      plate: "MP09ST7890",
      capacity: 1,
      vehicleType: "motorcycle",
    },
    location: {
      type: "Point",
      coordinates: [77.415, 23.235], // Roshanpura
    },
  },
];

// ========================================
// SEED FUNCTION
// ========================================
async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_CONNECT);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await userModel.deleteMany({});
    await captainModel.deleteMany({});
    console.log("✅ Cleared existing data");

    // Hash password
    console.log("🔐 Hashing passwords...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    // Insert users
    console.log("👤 Creating users...");
    const usersWithHashedPassword = sampleUsers.map((user) => ({
      ...user,
      password: hashedPassword,
    }));

    const users = await userModel.insertMany(usersWithHashedPassword);
    console.log(`✅ Created ${users.length} users`);

    // Insert captains
    console.log("🚗 Creating captains...");
    const captainsWithHashedPassword = sampleCaptains.map((captain) => ({
      ...captain,
      password: hashedPassword,
    }));

    const captains = await captainModel.insertMany(captainsWithHashedPassword);
    console.log(`✅ Created ${captains.length} captains`);

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 DATABASE SEEDED SUCCESSFULLY!");
    console.log("=".repeat(60));

    console.log("\n👤 USERS (" + users.length + " total):");
    console.log("─".repeat(60));
    users.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.fullname.firstname} ${user.fullname.lastname}`
      );
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Password: password123`);
      console.log("");
    });

    console.log("\n🚗 CAPTAINS (" + captains.length + " total):");
    console.log("─".repeat(60));

    // Group by vehicle type
    const carCaptains = captains.filter((c) => c.vehicle.vehicleType === "car");
    const autoCaptains = captains.filter(
      (c) => c.vehicle.vehicleType === "auto"
    );
    const motorcycleCaptains = captains.filter(
      (c) => c.vehicle.vehicleType === "motorcycle"
    );

    console.log(`\n🚙 CARS (${carCaptains.length}):`);
    carCaptains.forEach((captain, index) => {
      console.log(
        `${index + 1}. ${captain.fullname.firstname} ${
          captain.fullname.lastname
        }`
      );
      console.log(`   📧 Email: ${captain.email}`);
      console.log(`   🔑 Password: password123`);
      console.log(
        `   🚗 Vehicle: ${captain.vehicle.color} ${captain.vehicle.vehicleType} (${captain.vehicle.plate})`
      );
      console.log(`   👥 Capacity: ${captain.vehicle.capacity} seats`);
      console.log(
        `   📍 Location: [${captain.location.coordinates[0]}, ${captain.location.coordinates[1]}]`
      );
      console.log(`   📊 Status: ${captain.status}`);
      console.log("");
    });

    console.log(`\n🛺 AUTOS (${autoCaptains.length}):`);
    autoCaptains.forEach((captain, index) => {
      console.log(
        `${index + 1}. ${captain.fullname.firstname} ${
          captain.fullname.lastname
        }`
      );
      console.log(`   📧 Email: ${captain.email}`);
      console.log(`   🔑 Password: password123`);
      console.log(
        `   🛺 Vehicle: ${captain.vehicle.color} ${captain.vehicle.vehicleType} (${captain.vehicle.plate})`
      );
      console.log(`   👥 Capacity: ${captain.vehicle.capacity} seats`);
      console.log(
        `   📍 Location: [${captain.location.coordinates[0]}, ${captain.location.coordinates[1]}]`
      );
      console.log(`   📊 Status: ${captain.status}`);
      console.log("");
    });

    console.log(`\n🏍️ MOTORCYCLES (${motorcycleCaptains.length}):`);
    motorcycleCaptains.forEach((captain, index) => {
      console.log(
        `${index + 1}. ${captain.fullname.firstname} ${
          captain.fullname.lastname
        }`
      );
      console.log(`   📧 Email: ${captain.email}`);
      console.log(`   🔑 Password: password123`);
      console.log(
        `   🏍️ Vehicle: ${captain.vehicle.color} ${captain.vehicle.vehicleType} (${captain.vehicle.plate})`
      );
      console.log(`   👥 Capacity: ${captain.vehicle.capacity} seat`);
      console.log(
        `   📍 Location: [${captain.location.coordinates[0]}, ${captain.location.coordinates[1]}]`
      );
      console.log(`   📊 Status: ${captain.status}`);
      console.log("");
    });

    console.log("=".repeat(60));
    console.log("✅ All data seeded successfully!");
    console.log("🚀 You can now start your application");
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
