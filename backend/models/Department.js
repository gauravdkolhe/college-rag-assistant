import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required.'],
    trim: true,
    unique: true,
    minlength: [2, 'Department name must contain at least 2 characters.'],
    maxlength: [80, 'Department name must be 80 characters or fewer.']
  },
  sections: {
    type: [String],
    default: [],
    validate: {
      validator: (sections) => sections.every((section) => section.trim().length > 0 && section.length <= 40),
      message: 'Sections must contain 1 to 40 characters.'
    }
  }
}, { timestamps: true });

export default mongoose.model('Department', departmentSchema);
