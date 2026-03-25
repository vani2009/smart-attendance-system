require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { generateTeacherQR, generateStudentQR } = require('./backend/qrGenerator');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// test route
app.get('/', (req, res) => {
  res.send('Smart Attendance System API is running');
});


// ✅ Teacher QR route
app.post('/generate-teacher-qr', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const qr = await generateTeacherQR(sessionId);

    res.json({
      success: true,
      qr
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// ✅ Student QR route
app.post('/generate-student-qr', async (req, res) => {
  try {
    const { studentId, sessionId } = req.body;

    if (!studentId || !sessionId) {
      return res.status(400).json({ error: 'studentId and sessionId required' });
    }

    const qr = await generateStudentQR(studentId, sessionId);

    res.json({
      success: true,
      qr
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});