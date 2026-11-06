import { Router } from 'express';
import { createDepartment, deleteDepartment, getDepartment, listDepartments, updateDepartment } from '../controllers/departmentController.js';

const router = Router();

router.route('/').get(listDepartments).post(createDepartment);
router.route('/:id').get(getDepartment).put(updateDepartment).delete(deleteDepartment);

export default router;
