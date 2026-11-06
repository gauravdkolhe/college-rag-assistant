import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from './api.js';

const emptyStudent = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  section: '',
  semester: '',
  contact: ''
};

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ST';
}

function App() {
  const [page, setPage] = useState('overview');
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studentResponse, departmentResponse] = await Promise.all([
        request('/api/students'),
        request('/api/departments')
      ]);
      setStudents(studentResponse.data);
      setDepartments(departmentResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPage('students');
        window.requestAnimationFrame(() => document.getElementById('student-search')?.focus());
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const visibleStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesDepartment = !departmentFilter || student.department?._id === departmentFilter;
      const searchable = [student.studentId, student.name, student.email, student.department?.name, student.section]
        .join(' ').toLowerCase();
      return matchesDepartment && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [departmentFilter, query, students]);

  const openStudentDialog = (student = null) => {
    setDialog({
      type: 'student',
      student,
      values: student ? {
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        department: student.department?._id || '',
        section: student.section,
        semester: String(student.semester),
        contact: student.contact || ''
      } : { ...emptyStudent, department: departments[0]?._id || '' }
    });
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!dialog) return;
    setSaving(true);
    try {
      const values = {
        ...dialog.values,
        semester: Number(dialog.values.semester)
      };
      const path = dialog.student ? `/api/students/${encodeURIComponent(dialog.student.studentId)}` : '/api/students';
      await request(path, {
        method: dialog.student ? 'PUT' : 'POST',
        body: JSON.stringify(values)
      });
      setDialog(null);
      setNotice(dialog.student ? 'Student details updated.' : 'Student added successfully.');
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (student) => {
    if (!window.confirm(`Delete ${student.name} (${student.studentId})? This cannot be undone.`)) return;
    try {
      await request(`/api/students/${encodeURIComponent(student.studentId)}`, { method: 'DELETE' });
      setNotice(`${student.name} was deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const openDepartmentDialog = (department = null) => {
    setDialog({
      type: 'department',
      department,
      name: department?.name || '',
      sections: department ? department.sections.join(', ') : ''
    });
  };

  const saveDepartment = async (event) => {
    event.preventDefault();
    if (!dialog) return;
    setSaving(true);
    try {
      const sections = [...new Set(dialog.sections.split(',').map((section) => section.trim()).filter(Boolean))];
      const body = JSON.stringify({ name: dialog.name, sections });
      await request(dialog.department ? `/api/departments/${dialog.department._id}` : '/api/departments', {
        method: dialog.department ? 'PUT' : 'POST',
        body
      });
      setDialog(null);
      setNotice(dialog.department ? 'Department updated.' : 'Department created.');
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDepartment = async (department) => {
    if (!window.confirm(`Delete ${department.name}? Departments with enrolled students cannot be deleted.`)) return;
    try {
      await request(`/api/departments/${department._id}`, { method: 'DELETE' });
      setNotice(`${department.name} was deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const goToStudents = () => {
    setDepartmentFilter('');
    setQuery('');
    setPage('students');
  };

  const title = page === 'overview' ? 'Overview' : page === 'students' ? 'Students' : 'Departments';
  const isStudentDialog = dialog?.type === 'student';
  const sections = departments.find((department) => department._id === dialog?.values?.department)?.sections || [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('overview'); }}>
          <span className="brand-mark">C</span>
          <span className="brand-copy"><strong>CampusDesk</strong><small>STUDENT PORTAL</small></span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="navigation" aria-label="Main navigation">
          <button className={`nav-link ${page === 'overview' ? 'active' : ''}`} onClick={() => setPage('overview')}>
            <span className="nav-icon">◫</span> Overview
          </button>
          <button className={`nav-link ${page === 'students' ? 'active' : ''}`} onClick={goToStudents}>
            <span className="nav-icon">◎</span> Students <span className="nav-count">{students.length}</span>
          </button>
          <button className={`nav-link ${page === 'departments' ? 'active' : ''}`} onClick={() => setPage('departments')}>
            <span className="nav-icon">▦</span> Departments
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">i</span>
            <strong>Need a hand?</strong>
            <p>Manage your college records in one place.</p>
            <button onClick={() => setPage('departments')}>Explore departments <span>→</span></button>
          </div>
          <div className="profile">
            <span className="profile-avatar">AD</span>
            <span><strong>Administrator</strong><small>College workspace</small></span>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{title}</strong></div>
          <div className="topbar-right"><span className="online-dot" /> College workspace <span className="topbar-divider" /> <span className="today">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
        </header>
        <div className="content-wrap">
          {error && <div className="alert alert-error" role="alert"><span>!</span><div><strong>Something needs your attention</strong><p>{error}</p></div><button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
          {notice && <div className="alert alert-success" role="status"><span>✓</span><strong>{notice}</strong><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
          {loading && <div className="loading-bar"><span /></div>}

          {page === 'overview' && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow">YOUR COLLEGE AT A GLANCE</div><h1>Good day, Administrator <span className="wave">✦</span></h1><p>Here&apos;s what&apos;s happening across your campus today.</p></div>
                <button className="button button-primary" onClick={() => openStudentDialog()} disabled={!departments.length}><span className="plus">+</span> Add student</button>
              </div>
              <section className="stat-grid" aria-label="College statistics">
                <article className="stat-card"><div className="stat-top"><span>Total students</span><span className="stat-icon blue">◎</span></div><strong>{students.length}</strong><small><span className="stat-note">Across all departments</span></small></article>
                <article className="stat-card"><div className="stat-top"><span>Departments</span><span className="stat-icon violet">▦</span></div><strong>{departments.length}</strong><small><span className="stat-note">Academic departments</span></small></article>
                <article className="stat-card"><div className="stat-top"><span>Sections</span><span className="stat-icon green">▤</span></div><strong>{departments.reduce((total, department) => total + department.sections.length, 0)}</strong><small><span className="stat-note">Across all departments</span></small></article>
                <article className="stat-card"><div className="stat-top"><span>Active semesters</span><span className="stat-icon orange">◷</span></div><strong>{new Set(students.map((student) => student.semester)).size}</strong><small><span className="stat-note">Currently represented</span></small></article>
              </section>

              <section className="overview-grid">
                <article className="panel recent-panel">
                  <div className="panel-heading"><div><h2>Recent students</h2><p>Your latest student records</p></div><button className="text-button" onClick={goToStudents}>View all <span>→</span></button></div>
                  {students.length ? <StudentTable students={students.slice(0, 5)} onEdit={openStudentDialog} onDelete={deleteStudent} /> : <EmptyState title="No students yet" text="Add your first student to get your college records started." action="Add a student" onAction={() => openStudentDialog()} disabled={!departments.length} />}
                </article>
                <article className="panel department-panel">
                  <div className="panel-heading"><div><h2>Departments</h2><p>Academic areas and their sections</p></div><button className="icon-button" aria-label="Add department" title="Add department" onClick={() => openDepartmentDialog()}>+</button></div>
                  <div className="department-list">
                    {departments.length ? departments.slice(0, 5).map((department, index) => (
                      <div className="department-row" key={department._id}>
                        <span className={`department-avatar tone-${index % 4}`}>{department.name.slice(0, 1).toUpperCase()}</span>
                        <span className="department-info"><strong>{department.name}</strong><small>{department.sections.length ? department.sections.join(' · ') : 'No sections'}</small></span>
                        <span className="department-total">{students.filter((student) => student.department?._id === department._id).length} <small>students</small></span>
                      </div>
                    )) : <EmptyState title="No departments" text="Create a department before enrolling students." action="Create department" onAction={() => openDepartmentDialog()} />}
                  </div>
                  <button className="department-footer" onClick={() => setPage('departments')}>Manage departments <span>→</span></button>
                </article>
              </section>
              <div className="architecture-note"><span className="architecture-dot" /><span><strong>Three-tier architecture</strong> · Your frontend, API, and database run as independent services.</span><span className="architecture-pill">NETLIFY&nbsp; → &nbsp;RENDER&nbsp; → &nbsp;MONGODB ATLAS</span></div>
            </>
          )}

          {page === 'students' && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow">PEOPLE &amp; RECORDS</div><h1>Students</h1><p>Search, organize, and manage your student records.</p></div>
                <button className="button button-primary" onClick={() => openStudentDialog()} disabled={!departments.length}><span className="plus">+</span> Add student</button>
              </div>
              {!departments.length && <div className="setup-hint">Before enrolling students, <button className="text-button" onClick={() => setPage('departments')}>create a department</button> and its sections.</div>}
              <section className="panel students-panel">
                <div className="list-toolbar">
                  <div><h2>All students <span className="result-count">{visibleStudents.length}</span></h2><p>Browse and manage student details</p></div>
                  <div className="filters">
                    <label className="search-box"><span>⌕</span><input id="student-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students..." aria-label="Search students" /><kbd>⌘ K</kbd></label>
                    <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="">All departments</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select>
                  </div>
                </div>
                {visibleStudents.length ? <StudentTable students={visibleStudents} onEdit={openStudentDialog} onDelete={deleteStudent} /> : <EmptyState title={students.length ? 'No matching students' : 'No students yet'} text={students.length ? 'Try a different name, ID, or department.' : 'Your student records will appear here once added.'} action={students.length ? undefined : 'Add a student'} onAction={() => openStudentDialog()} disabled={!departments.length} />}
              </section>
            </>
          )}

          {page === 'departments' && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow">ACADEMIC STRUCTURE</div><h1>Departments</h1><p>Set up departments and the sections within each one.</p></div>
                <button className="button button-primary" onClick={() => openDepartmentDialog()}><span className="plus">+</span> Add department</button>
              </div>
              <div className="department-summary">Departments organize your students. Add sections such as <strong>A</strong> and <strong>B</strong> to match your college structure.</div>
              {departments.length ? <section className="department-card-grid">
                {departments.map((department, index) => {
                  const departmentStudents = students.filter((student) => student.department?._id === department._id);
                  return <article className="panel department-card" key={department._id}>
                    <div className="department-card-heading"><span className={`department-avatar department-avatar-large tone-${index % 4}`}>{department.name.slice(0, 1).toUpperCase()}</span><div><h2>{department.name}</h2><p>{departmentStudents.length} {departmentStudents.length === 1 ? 'student' : 'students'}</p></div><button className="icon-button subtle-icon" aria-label={`Edit ${department.name}`} onClick={() => openDepartmentDialog(department)}>✎</button><button className="icon-button subtle-icon delete-icon" aria-label={`Delete ${department.name}`} onClick={() => deleteDepartment(department)}>×</button></div>
                    <div className="section-label">SECTIONS <span>{department.sections.length}</span></div>
                    <div className="section-chips">{department.sections.map((section) => <span className="section-chip" key={section}>{section}</span>)}{!department.sections.length && <span className="muted-text">No sections added</span>}</div>
                    <button className="card-edit-button" onClick={() => openDepartmentDialog(department)}>Edit department &amp; sections <span>→</span></button>
                  </article>;
                })}
              </section> : <section className="panel department-empty"><EmptyState title="Build your academic structure" text="Add your first department and sections to start enrolling students." action="Create department" onAction={() => openDepartmentDialog()} /></section>}
            </>
          )}
        </div>
      </main>

      {dialog && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading"><div><div className="eyebrow">{isStudentDialog ? 'STUDENT RECORD' : 'ACADEMIC STRUCTURE'}</div><h2 id="modal-title">{isStudentDialog ? (dialog.student ? 'Edit student' : 'Add a student') : (dialog.department ? 'Edit department' : 'Create a department')}</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setDialog(null)}>×</button></div>
          <form onSubmit={isStudentDialog ? saveStudent : saveDepartment}>
            {isStudentDialog ? <>
              <div className="form-grid">
                <label>Student ID<input required maxLength="30" value={dialog.values.studentId} disabled={Boolean(dialog.student)} placeholder="e.g. ST101" onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, studentId: event.target.value } })} /></label>
                <label>Full name<input required maxLength="100" value={dialog.values.name} placeholder="e.g. Rahul Sharma" onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, name: event.target.value } })} /></label>
                <label>Email address<input required type="email" maxLength="254" value={dialog.values.email} placeholder="student@college.edu" onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, email: event.target.value } })} /></label>
                <label>Department<select required value={dialog.values.department} onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, department: event.target.value, section: '' } })}><option value="" disabled>Select department</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select></label>
                <label>Section<select required value={dialog.values.section} disabled={!sections.length} onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, section: event.target.value } })}><option value="" disabled>{sections.length ? 'Select section' : 'Add sections to this department'}</option>{sections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
                <label>Semester<input required type="number" min="1" max="12" value={dialog.values.semester} placeholder="1–12" onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, semester: event.target.value } })} /></label>
                <label className="form-full">Contact number <span className="optional-label">OPTIONAL</span><input type="tel" maxLength="20" value={dialog.values.contact} placeholder="e.g. 9876543210" onChange={(event) => setDialog({ ...dialog, values: { ...dialog.values, contact: event.target.value } })} /></label>
              </div>
            </> : <>
              <div className="form-grid department-form">
                <label className="form-full">Department name<input required maxLength="80" value={dialog.name} placeholder="e.g. Computer Science and Engineering" onChange={(event) => setDialog({ ...dialog, name: event.target.value })} /></label>
                <label className="form-full">Sections <span className="optional-label">COMMA SEPARATED</span><input value={dialog.sections} maxLength="500" placeholder="A, B" onChange={(event) => setDialog({ ...dialog, sections: event.target.value })} /><small className="field-help">Students are assigned to one of these sections. Existing sections with enrolled students cannot be removed.</small></label>
              </div>
            </>}
            <div className="modal-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : isStudentDialog ? (dialog.student ? 'Save changes' : 'Add student') : (dialog.department ? 'Save changes' : 'Create department')}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

function StudentTable({ students, onEdit, onDelete }) {
  return <div className="table-scroll"><table className="student-table"><thead><tr><th>STUDENT</th><th>STUDENT ID</th><th>DEPARTMENT</th><th>SECTION</th><th>SEMESTER</th><th className="actions-column">ACTIONS</th></tr></thead><tbody>
    {students.map((student, index) => <tr key={student._id}>
      <td><div className="student-cell"><span className={`student-avatar avatar-${index % 5}`}>{initials(student.name)}</span><span><strong>{student.name}</strong><small>{student.email}</small></span></div></td>
      <td><span className="id-badge">{student.studentId}</span></td>
      <td>{student.department?.name || '—'}</td>
      <td><span className="section-chip section-chip-small">{student.section}</span></td>
      <td><span className="semester-badge">Semester {student.semester}</span></td>
      <td><div className="row-actions"><button aria-label={`Edit ${student.name}`} title="Edit student" onClick={() => onEdit(student)}>✎</button><button className="row-delete" aria-label={`Delete ${student.name}`} title="Delete student" onClick={() => onDelete(student)}>⌫</button></div></td>
    </tr>)}
  </tbody></table></div>;
}

function EmptyState({ title, text, action, onAction, disabled = false }) {
  return <div className="empty-state"><span className="empty-icon">◎</span><h3>{title}</h3><p>{text}</p>{action && <button className="button button-secondary" onClick={onAction} disabled={disabled}>{action}</button>}</div>;
}

export default App;
