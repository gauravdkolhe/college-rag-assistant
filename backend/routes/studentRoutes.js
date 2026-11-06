import { Router } from 'express';
import { createStudent, deleteStudent, getStudent, listStudents, updateStudent } from '../controllers/studentController.js';

const router = Router();

router.route('/').get(listStudents).post(createStudent);
router.route('/:id').get(getStudent).put(updateStudent).delete(deleteStudent);

export default router;
