import mongoose from 'mongoose';
import Department from '../models/Department.js';
import Student from '../models/Student.js';
import { asyncHandler, sendValidationError } from '../utils/http.js';

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return sections;
  return [...new Set(sections.map((section) => String(section).trim()).filter(Boolean))];
}

export const seedDefaultDepartments = async () => {
  if (await Department.exists({})) return;
  await Department.create({ name: 'Computer Science and Engineering', sections: ['A', 'B'] });
  console.log('Created starter Computer Science and Engineering department with sections A and B.');
};

export const listDepartments = asyncHandler(async (_request, response) => {
  const departments = await Department.find().sort({ name: 1 }).lean();
  const counts = await Student.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }]);
  const countByDepartment = new Map(counts.map((item) => [String(item._id), item.count]));
  const data = departments.map((department) => ({ ...department, studentCount: countByDepartment.get(String(department._id)) || 0 }));
  response.json({ success: true, data });
});

export const getDepartment = asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ success: false, message: 'Department ID is invalid.' });
  const department = await Department.findById(request.params.id);
  if (!department) return response.status(404).json({ success: false, message: 'Department not found.' });
  response.json({ success: true, data: department });
});

export const createDepartment = asyncHandler(async (request, response, next) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
  }
  try {
    const department = await Department.create({ name: request.body.name, sections: normalizeSections(request.body.sections || []) });
    return response.status(201).json({ success: true, message: 'Department created successfully.', data: department });
  } catch (error) {
    return sendValidationError(error, response, next);
  }
});

export const updateDepartment = asyncHandler(async (request, response, next) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
  }
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ success: false, message: 'Department ID is invalid.' });
  const department = await Department.findById(request.params.id);
  if (!department) return response.status(404).json({ success: false, message: 'Department not found.' });
  const sections = Object.hasOwn(request.body, 'sections') ? normalizeSections(request.body.sections) : department.sections;
  if (!Array.isArray(sections)) return response.status(400).json({ success: false, message: 'Sections must be provided as a list.' });
  const removedSections = department.sections.filter((section) => !sections.includes(section));
  if (removedSections.length && await Student.exists({ department: department._id, section: { $in: removedSections } })) {
    return response.status(409).json({ success: false, message: 'Move enrolled students to another section before removing these sections.' });
  }
  try {
    if (Object.hasOwn(request.body, 'name')) department.name = request.body.name;
    department.sections = sections;
    await department.save();
    return response.json({ success: true, message: 'Department updated successfully.', data: department });
  } catch (error) {
    return sendValidationError(error, response, next);
  }
});

export const deleteDepartment = asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ success: false, message: 'Department ID is invalid.' });
  const department = await Department.findById(request.params.id);
  if (!department) return response.status(404).json({ success: false, message: 'Department not found.' });
  if (await Student.exists({ department: department._id })) {
    return response.status(409).json({ success: false, message: 'Move or remove this department’s students before deleting the department.' });
  }
  await department.deleteOne();
  response.json({ success: true, message: 'Department deleted successfully.' });
});
