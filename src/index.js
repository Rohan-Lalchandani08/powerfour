require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");
const routes = require("./routes");

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for frontend development
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
}));

app.use(express.json());
app.use("/api", routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Employee analytics backend listening on port ${port}`);
  });
});
