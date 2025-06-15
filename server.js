const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// In-memory job storage
const jobs = new Map();

// Job statuses
const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running', 
  DONE: 'done',
  ERROR: 'error'
};

// Simulate job processing
function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  // Set to running
  job.status = JOB_STATUS.RUNNING;
  job.startTime = new Date();

  // Simulate processing time (5-10 seconds)
  const processingTime = Math.random() * 5000 + 5000; // 5-10 seconds

  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;

    // Simulate occasional errors (10% chance)
    if (Math.random() < 0.1) {
      job.status = JOB_STATUS.ERROR;
      job.error = 'Processing failed due to simulated error';
      job.endTime = new Date();
    } else {
      job.status = JOB_STATUS.DONE;
      job.endTime = new Date();
      
      // Generate dummy result based on flags
      job.result = generateDummyResult(job.flags, job.files);
    }
  }, processingTime);
}

// Generate dummy results
function generateDummyResult(flags, files) {
  const results = {
    message: 'Processing completed successfully',
    processedFiles: files.map(f => f.originalname),
    flags: flags,
    timestamp: new Date().toISOString(),
    data: {}
  };

  // Add different dummy data based on flags
  if (flags.includes('analyze')) {
    results.data.analysis = {
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      fileTypes: [...new Set(files.map(f => path.extname(f.originalname)))]
    };
  }

  if (flags.includes('convert')) {
    results.data.conversion = {
      status: 'converted',
      outputFormat: 'processed',
      compressionRatio: Math.random() * 0.5 + 0.3 // 30-80%
    };
  }

  if (flags.includes('extract')) {
    results.data.extraction = {
      extractedItems: Math.floor(Math.random() * 50) + 10,
      categories: ['text', 'images', 'metadata'],
      confidence: Math.random() * 0.3 + 0.7 // 70-100%
    };
  }

  // Generate dummy file download link
  results.downloadUrl = `/download/${uuidv4()}.zip`;

  return results;
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload endpoint
app.post('/upload', upload.array('files'), (req, res) => {
  try {
    const files = req.files || [];
    const flags = req.body.flags ? JSON.parse(req.body.flags) : [];
    
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const jobId = uuidv4();
    const job = {
      id: jobId,
      status: JOB_STATUS.PENDING,
      files: files.map(f => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size
      })),
      flags: flags,
      createdAt: new Date(),
      startTime: null,
      endTime: null,
      result: null,
      error: null
    };

    jobs.set(jobId, job);
    
    // Start processing
    setTimeout(() => processJob(jobId), 1000);

    res.json({ 
      job_id: jobId,
      message: 'Files uploaded successfully',
      fileCount: files.length,
      flags: flags
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Status endpoint
app.get('/status/:job_id', (req, res) => {
  const jobId = req.params.job_id;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const response = {
    job_id: jobId,
    status: job.status,
    created_at: job.createdAt,
    files: job.files,
    flags: job.flags
  };

  if (job.startTime) response.started_at = job.startTime;
  if (job.endTime) response.completed_at = job.endTime;
  if (job.error) response.error = job.error;

  // Add progress for running jobs
  if (job.status === JOB_STATUS.RUNNING && job.startTime) {
    const elapsed = Date.now() - job.startTime.getTime();
    const estimatedTotal = 7500; // Average of 5-10 seconds
    response.progress = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 95);
  }

  res.json(response);
});

// Result endpoint
app.get('/result/:job_id', (req, res) => {
  const jobId = req.params.job_id;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== JOB_STATUS.DONE) {
    return res.status(400).json({ 
      error: 'Job not completed',
      status: job.status 
    });
  }

  res.json({
    job_id: jobId,
    status: job.status,
    result: job.result,
    completed_at: job.endTime
  });
});

// History endpoint
app.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  
  const allJobs = Array.from(jobs.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(offset, offset + limit)
    .map(job => ({
      job_id: job.id,
      status: job.status,
      created_at: job.createdAt,
      completed_at: job.endTime,
      file_count: job.files.length,
      flags: job.flags
    }));

  res.json({
    jobs: allJobs,
    total: jobs.size,
    limit,
    offset
  });
});

// Dummy download endpoint
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Generate dummy file content
  const dummyContent = JSON.stringify({
    message: 'This is a dummy processed file',
    filename: filename,
    processed_at: new Date().toISOString(),
    content: 'Dummy processed data would be here...'
  }, null, 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(dummyContent);
});

// Clear all jobs (for testing)
app.delete('/jobs', (req, res) => {
  jobs.clear();
  res.json({ message: 'All jobs cleared' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dummy server running on http://localhost:${PORT}`);
  console.log(`�� Available endpoints:`);
  console.log(`   POST /upload        - Upload files with flags`);
  console.log(`   GET  /status/:id    - Check job status`);
  console.log(`   GET  /result/:id    - Get job result`);
  console.log(`   GET  /history       - Get job history`);
  console.log(`   GET  /health        - Health check`);
  console.log(`   DELETE /jobs        - Clear all jobs (testing)`);
});

module.exports = app;
