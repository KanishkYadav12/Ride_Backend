const mongoose = require("mongoose");

function connectToDb() {
  return mongoose
    .connect(process.env.DB_CONNECT)
    .then(() => {
      console.log("Connected to DB");
    })
    .catch((err) => {
      console.error("Failed to connect to DB:", err.message);
      throw err;
    });
}

module.exports = connectToDb;
