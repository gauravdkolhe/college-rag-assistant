import mongoose from 'mongoose';
import Student from '../models/Student.js';
import Department from '../models/Department.js';
import { asyncHandler, findStudentByIdentifier, sendValidationError } from '../utils/http.js';

const studentFields = ['studentId', 'name', 'email', 'department', 'section', 'semester', 'contact'];

function studentInput(body) {
  return Object.fromEntries(studentFields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]));
}

async function validateDepartmentSection(departmentId, section) {
  if (!mongoose.isValidObjectId(departmentId)) return 'Select a valid department.';
  const department = await Department.findById(departmentId).select('sections');
  if (!department) return 'The selected department does not exist.';
  if (!section || !department.sections.includes(String(section).trim())) return 'Choose a section that belongs to the selected department.';
  return null;
}

export const listStudents = asyncHandler(async (request, response) => {
  const filter = {};
  if (request.query.department) {
    if (!mongoose.isValidObjectId(request.query.department)) return response.status(400).json({ success: false, message: 'Department filter is invalid.' });
    filter.department = request.query.department;
  }
  if (request.query.section) filter.section = String(request.query.section).trim();
  if (request.query.q) {
    const escaped = String(request.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped.length > 0) {
      const search = new RegExp(escaped, 'i');
      const matchingDepartments = await Department.find({ name: search }).distinct('_id');
      filter.$or = [{ studentId: search }, { name: search }, { email: search }, { section: search }, { department: { $in: matchingDepartments } }];
    }
  }
  const data = await Student.find(filter).populate('department', 'name sections').sort({ createdAt: -1 }).limit(500);
  response.json({ success: true, data });
});

export const getStudent = asyncHandler(async (request, response) => {
  const student = await findStudentByIdentifier(Student, request.params.id);
  if (!student) return response.status(404).json({ success: false, message: 'Student not found.' });
  response.json({ success: true, data: student });
});

export const createStudent = asyncHandler(async (request, response, next) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
  }
  const input = studentInput(request.body);
  const invalidAssignment = await validateDepartmentSection(input.department, input.section);
  if (invalidAssignment) return response.status(400).json({ success: false, message: invalidAssignment });
  try {
    const student = await Student.create(input);
    await student.populate('department', 'name sections');
    return response.status(201).json({ success: true, message: 'Student added successfully.', data: student });
  } catch (error) {
    return sendValidationError(error, response, next);
  }
});

export const updateStudent = asyncHandler(async (request, response, next) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
  }
  const student = await findStudentByIdentifier(Student, request.params.id);
  if (!student) return response.status(404).json({ success: false, message: 'Student not found.' });
  const input = studentInput(request.body);
  const departmentId = input.department || student.department._id;
  const section = input.section || student.section;
  const invalidAssignment = await validateDepartmentSection(departmentId, section);
  if (invalidAssignment) return response.status(400).json({ success: false, message: invalidAssignment });
  try {
    Object.assign(student, input);
    await student.save();
    await student.populate('department', 'name sections');
    return response.json({ success: true, message: 'Student updated successfully.', data: student });
  } catch (error) {
    return sendValidationError(error, response, next);
  }
});

export const deleteStudent = asyncHandler(async (request, response) => {
  const student = await findStudentByIdentifier(Student, request.params.id);
  if (!student) return response.status(404).json({ success: false, message: 'Student not found.' });
  await student.deleteOne();
  response.json({ success: true, message: 'Student deleted successfully.' });
});
