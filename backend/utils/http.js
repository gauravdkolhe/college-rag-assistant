import mongoose from 'mongoose';

export function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

export function findStudentByIdentifier(Student, identifier) {
  if (mongoose.isValidObjectId(identifier)) return Student.findById(identifier).populate('department', 'name sections');
  return Student.findOne({ studentId: identifier.trim().toUpperCase() }).populate('department', 'name sections');
}

export function sendValidationError(error, response, next) {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    return response.status(409).json({
      success: false,
      message: field === 'email' ? 'A student with this email already exists.' : `A record with this ${field || 'value'} already exists.`
    });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'StrictModeError') {
    const message = error.name === 'ValidationError'
      ? Object.values(error.errors).map((item) => item.message).join(' ')
      : 'One or more submitted values are invalid.';
    return response.status(400).json({ success: false, message });
  }
  return next(error);
}
