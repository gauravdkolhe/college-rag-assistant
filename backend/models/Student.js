import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: [true, 'Student ID is required.'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [2, 'Student ID must contain at least 2 characters.'],
    maxlength: [30, 'Student ID must be 30 characters or fewer.']
  },
  name: {
    type: String,
    required: [true, 'Student name is required.'],
    trim: true,
    minlength: [2, 'Name must contain at least 2 characters.'],
    maxlength: [100, 'Name must be 100 characters or fewer.']
  },
  email: {
    type: String,
    required: [true, 'Email is required.'],
    trim: true,
    lowercase: true,
    maxlength: [254, 'Email must be 254 characters or fewer.'],
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
    unique: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required.']
  },
  section: {
    type: String,
    required: [true, 'Section is required.'],
    trim: true,
    maxlength: [40, 'Section must be 40 characters or fewer.']
  },
  semester: {
    type: Number,
    required: [true, 'Semester is required.'],
    min: [1, 'Semester must be at least 1.'],
    max: [12, 'Semester must be 12 or fewer.'],
    validate: { validator: Number.isInteger, message: 'Semester must be a whole number.' }
  },
  contact: {
    type: String,
    trim: true,
    maxlength: [20, 'Contact number must be 20 characters or fewer.'],
    default: ''
  }
}, { timestamps: true });

studentSchema.index({ name: 'text', studentId: 'text', email: 'text' });
studentSchema.index({ department: 1, section: 1 });

export default mongoose.model('Student', studentSchema);
