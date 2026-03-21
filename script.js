let currentUser = null;

function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }, duration);
}

function validateField(field, isValid, message = '') {
    field.classList.remove('is-valid', 'is-invalid');
    const existingFeedback = field.parentElement.querySelector('.invalid-feedback, .valid-feedback');
    if (existingFeedback) existingFeedback.remove();
    
    if (isValid) {
        field.classList.add('is-valid');
    } else {
        field.classList.add('is-invalid');
        if (message) {
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.textContent = message;
            field.parentElement.appendChild(feedback);
        }
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    if (password.length < 6) return { isValid: false, message: 'password must be at least 6 characters' };
    if (password.length < 8) return { isValid: true, message: 'password is weak. consider using 8+ characters' };
    return { isValid: true, message: 'password strength: good' };
}

function clearFormValidation(form) {
    form.querySelectorAll('.is-valid, .is-invalid').forEach(field => {
        field.classList.remove('is-valid', 'is-invalid');
    });
    form.querySelectorAll('.invalid-feedback, .valid-feedback').forEach(feedback => feedback.remove());
}

function setButtonLoading(button) {
    button.disabled = true;
    button.classList.add('btn-loading');
    button.dataset.originalText = button.textContent;
}

function removeButtonLoading(button) {
    button.disabled = false;
    button.classList.remove('btn-loading');
    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

const STORAGE_KEY = 'ipt_demo_v1';

window.db = {
    accounts: [],
    employees: [],
    departments: [],
    requests: []
};

function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            window.db = JSON.parse(stored);
            if (window.db.users && !window.db.accounts) {
                window.db.accounts = window.db.users;
                delete window.db.users;
                saveToStorage();
            }
        } else {
            seedInitialData();
        }
    } catch (error) {
        console.error('error loading from storage:', error);
        seedInitialData();
    }
}

function seedInitialData() {
    window.db = {
        accounts: [{
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            password: 'Password123!',
            role: 'Admin',
            verified: true
        }],
        employees: [],
        departments: [
            { name: 'Engineering', description: 'Software Development' },
            { name: 'HR', description: 'Human Resources' },
            { name: 'Sales', description: 'Sales and Marketing' },
            { name: 'Marketing', description: 'Brand and Marketing' }
        ],
        requests: []
    };
    saveToStorage();
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
    } catch (error) {
        console.error('error saving to storage:', error);
    }
}

loadFromStorage();

function setAuthState(isAuth, user = null) {
    const body = document.body;
    
    if (isAuth && user) {
        currentUser = user;
        body.classList.remove('not-authenticated');
        body.classList.add('authenticated');
        if (user.role === 'Admin') {
            body.classList.add('is-admin');
        } else {
            body.classList.remove('is-admin');
        }
    } else {
        currentUser = null;
        body.classList.remove('authenticated', 'is-admin');
        body.classList.add('not-authenticated');
    }
}

function navigateTo(hash) {
    window.location.hash = hash;
}

function handleRouting() {
    const hash = window.location.hash || '#/';
    const route = hash.substring(2);
    
    document.querySelectorAll('section').forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
    });
    
    const protectedRoutes = ['profile', 'employees', 'departments', 'accounts', 'my-requests', 'all-requests'];
    const adminRoutes = ['employees', 'departments', 'accounts', 'all-requests'];
    
    if (protectedRoutes.includes(route) && !currentUser) {
        navigateTo('#/login');
        return;
    }
    
    if (adminRoutes.includes(route) && (!currentUser || currentUser.role !== 'Admin')) {
        navigateTo('#/profile');
        return;
    }
    
    let pageToShow = null;
    
    switch(route) {
        case '':
        case 'home':
            pageToShow = document.getElementById('homeSection');
            break;
        case 'login':
            pageToShow = document.getElementById('loginSection');
            break;
        case 'register':
            pageToShow = document.getElementById('registerSection');
            break;
        case 'verify-email':
            pageToShow = document.getElementById('verifyEmailSection');
            break;
        case 'profile':
            pageToShow = document.getElementById('profileSection');
            renderProfile();
            break;
        case 'employees':
            pageToShow = document.getElementById('employeesSection');
            loadEmployees();
            break;
        case 'departments':
            pageToShow = document.getElementById('departmentsSection');
            loadDepartments();
            break;
        case 'accounts':
            pageToShow = document.getElementById('accountsSection');
            loadAccounts();
            break;
        case 'my-requests':
            pageToShow = document.getElementById('myRequestsSection');
            loadMyRequests();
            break;
        case 'all-requests':
            pageToShow = document.getElementById('allRequestsSection');
            loadAllRequests();
            break;
        default:
            navigateTo('#/');
            return;
    }
    
    if (pageToShow) {
        pageToShow.style.display = 'block';
        pageToShow.classList.add('active');
    }
}

window.addEventListener('hashchange', handleRouting);

const homeSection = document.getElementById('homeSection');
const registerSection = document.getElementById('registerSection');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const getStartedBtn = document.getElementById('getStartedBtn');
const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
const registerForm = document.getElementById('registerForm');
const verifyEmailSection = document.getElementById('verifyEmailSection');
const loginSection = document.getElementById('loginSection');
const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
const simulateVerifyBtn = document.getElementById('simulateVerifyBtn');
const goToLoginBtn = document.getElementById('goToLoginBtn');
const verifiedAlert = document.getElementById('verifiedAlert');
const cancelLoginBtn = document.getElementById('cancelLoginBtn');
const navLoggedIn = document.getElementById('navLoggedIn');
const navNotLoggedIn = document.getElementById('navNotLoggedIn');
const usernameDisplay = document.getElementById('usernameDisplay');
const profileSection = document.getElementById('profileSection');
const employeesSection = document.getElementById('employeesSection');
const profileLink = document.getElementById('profileLink');
const employeesLink = document.getElementById('employeesLink');
const logoutLink = document.getElementById('logoutLink');
const loginForm = document.getElementById('loginForm');
const addEmployeeBtn = document.getElementById('addEmployeeBtn');
const employeeFormSection = document.getElementById('employeeFormSection');
const cancelEmployeeBtn = document.getElementById('cancelEmployeeBtn');
const departmentsSection = document.getElementById('departmentsSection');
const accountsSection = document.getElementById('accountsSection');
const departmentsLink = document.getElementById('departmentsLink');
const accountsLink = document.getElementById('accountsLink');
const addDepartmentBtn = document.getElementById('addDepartmentBtn');
const addAccountBtn = document.getElementById('addAccountBtn');
const departmentFormSection = document.getElementById('departmentFormSection');
const accountFormSection = document.getElementById('accountFormSection');
const cancelDepartmentBtn = document.getElementById('cancelDepartmentBtn');
const cancelAccountBtn = document.getElementById('cancelAccountBtn');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const myRequestsSection = document.getElementById('myRequestsSection');
const myRequestsLink = document.getElementById('myRequestsLink');
const newRequestBtn = document.getElementById('newRequestBtn');
const createFirstRequestBtn = document.getElementById('createFirstRequestBtn');
const requestModal = document.getElementById('requestModal');
const closeRequestModal = document.getElementById('closeRequestModal');
const requestForm = document.getElementById('requestForm');
const noRequestsMessage = document.getElementById('noRequestsMessage');
const requestsTable = document.getElementById('requestsTable');
const allRequestsSection = document.getElementById('allRequestsSection');
const allRequestsLink = document.getElementById('allRequestsLink');

registerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/register');
});

cancelRegisterBtn.addEventListener('click', () => {
    navigateTo('#/');
});

getStartedBtn.addEventListener('click', () => {
    navigateTo('#/register');
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('regFirstName').value;
    const lastName = document.getElementById('regLastName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    if (password.length < 6) {
        showToast('password must be at least 6 characters long', 'error');
        return;
    }
    
    const existingAccount = window.db.accounts.find(acc => acc.email === email);
    if (existingAccount) {
        showToast('an account with this email already exists', 'error');
        return;
    }
    
    const userData = {
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
        role: 'User',
        verified: false
    };
    
    localStorage.setItem('unverified_email', email);
    localStorage.setItem('pendingUser', JSON.stringify(userData));
    
    showToast('registration successful! please verify your email', 'success');
    
    verifyEmailDisplay.textContent = email;
    navigateTo('#/verify-email');
    
    registerForm.reset();
});

simulateVerifyBtn.addEventListener('click', () => {
    const userData = JSON.parse(localStorage.getItem('pendingUser'));
    const unverifiedEmail = localStorage.getItem('unverified_email');
    
    if (userData && unverifiedEmail === userData.email) {
        userData.verified = true;
        window.db.accounts.push(userData);
        saveToStorage();
        
        localStorage.removeItem('pendingUser');
        localStorage.removeItem('unverified_email');
        
        verifiedAlert.style.display = 'block';
        showToast('email verified successfully!', 'success');
        navigateTo('#/login');
    } else {
        showToast('verification failed. please register again', 'error');
    }
});

goToLoginBtn.addEventListener('click', () => {
    navigateTo('#/login');
});

cancelLoginBtn.addEventListener('click', () => {
    verifiedAlert.style.display = 'none';
    navigateTo('#/');
});

loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/login');
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const account = window.db.accounts.find(acc => 
        acc.email === email && 
        acc.password === password && 
        acc.verified === true
    );
    
    if (account) {
        const loggedInUser = {
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
            role: account.role
        };
        
        localStorage.setItem('auth_token', email);
        localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
        
        setAuthState(true, loggedInUser);
        showLoggedInNav(loggedInUser);
        
        showToast(`welcome back, ${loggedInUser.firstName}!`, 'success');
        
        navigateTo('#/profile');
        loginForm.reset();
    } else {
        showToast('invalid email or password, or email not verified', 'error');
    }
});

function showLoggedInNav(user) {
    navNotLoggedIn.setAttribute('style', 'display: none !important');
    navLoggedIn.setAttribute('style', 'display: block !important');
    usernameDisplay.textContent = user.firstName || 'Admin';

    document.querySelectorAll('.role-admin').forEach(link => {
        link.style.display = user.role === 'Admin' ? 'block' : 'none';
    });
    
    document.querySelectorAll('.role-user').forEach(link => {
        link.style.display = user.role === 'User' ? 'block' : 'none';
    });
}

function renderProfile() {
    const user = currentUser;
    if (!user) return;
    
    document.getElementById('profileName').textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileRole').textContent = user.role;
}

function updateProfileDisplay(user) {
    if (!user) return;
    document.getElementById('profileName').textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileRole').textContent = user.role;
}

document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    showToast('edit profile feature coming soon!', 'info');
});

profileLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/profile');
});

employeesLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/employees');
});

logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    
    const userName = currentUser ? currentUser.firstName : 'user';
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('loggedInUser');
    
    setAuthState(false);
    
    navLoggedIn.style.display = 'none';
    navNotLoggedIn.style.display = 'flex';
    
    showToast(`goodbye, ${userName}!`, 'info');
    navigateTo('#/');
});

addEmployeeBtn.addEventListener('click', () => {
    employeeFormSection.style.display = 'block';
    document.getElementById('employeeFormTitle').textContent = 'Add Employee';
    document.getElementById('employeeForm').reset();
    document.getElementById('empId').removeAttribute('readonly');
    delete document.getElementById('employeeForm').dataset.originalId;
});

cancelEmployeeBtn.addEventListener('click', () => {
    employeeFormSection.style.display = 'none';
});

function loadEmployees() {
    const employees = window.db.employees;
    const tbody = document.getElementById('employeesTableBody');
    
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">no employees.</td></tr>';
    } else {
        tbody.innerHTML = employees.map(emp => `
            <tr>
                <td>${emp.id}</td>
                <td>${emp.email}</td>
                <td>${emp.position}</td>
                <td>${emp.department}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editEmployee('${emp.id}')">edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEmployee('${emp.id}')">delete</button>
                </td>
            </tr>
        `).join('');
    }
}

function editEmployee(id) {
    const employee = window.db.employees.find(emp => emp.id === id);
    
    if (employee) {
        employeeFormSection.style.display = 'block';
        document.getElementById('employeeFormTitle').textContent = 'Edit Employee';
        document.getElementById('empId').value = employee.id;
        document.getElementById('empEmail').value = employee.email;
        document.getElementById('empPosition').value = employee.position;
        document.getElementById('empDepartment').value = employee.department;
        document.getElementById('empHireDate').value = employee.hireDate;
        
        document.getElementById('empId').setAttribute('readonly', true);
        document.getElementById('employeeForm').dataset.originalId = id;
    }
}

document.getElementById('employeeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const employee = {
        id: document.getElementById('empId').value,
        email: document.getElementById('empEmail').value,
        position: document.getElementById('empPosition').value,
        department: document.getElementById('empDepartment').value,
        hireDate: document.getElementById('empHireDate').value
    };
    
    const originalId = document.getElementById('employeeForm').dataset.originalId;
    
    if (originalId) {
        const empIndex = window.db.employees.findIndex(e => e.id === originalId);
        if (empIndex !== -1) {
            window.db.employees[empIndex] = employee;
            showToast('employee updated successfully', 'success');
        }
        delete document.getElementById('employeeForm').dataset.originalId;
        document.getElementById('empId').removeAttribute('readonly');
    } else {
        const existingEmployee = window.db.employees.find(e => e.id === employee.id);
        if (existingEmployee) {
            showToast('an employee with this id already exists', 'error');
            return;
        }
        window.db.employees.push(employee);
        showToast('employee added successfully', 'success');
    }
    
    saveToStorage();
    employeeFormSection.style.display = 'none';
    document.getElementById('employeeForm').reset();
    loadEmployees();
});

function deleteEmployee(id) {
    if (confirm(`delete employee "${id}"?`)) {
        window.db.employees = window.db.employees.filter(e => e.id !== id);
        saveToStorage();
        loadEmployees();
        showToast('employee deleted successfully', 'success');
    }
}

departmentsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/departments');
});

accountsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/accounts');
});

addDepartmentBtn.addEventListener('click', () => {
    departmentFormSection.style.display = 'block';
    document.getElementById('departmentFormTitle').textContent = 'Add Department';
    document.getElementById('departmentForm').reset();
    document.getElementById('deptName').removeAttribute('readonly');
    delete document.getElementById('departmentForm').dataset.originalName;
});

cancelDepartmentBtn.addEventListener('click', () => {
    departmentFormSection.style.display = 'none';
});

addAccountBtn.addEventListener('click', () => {
    accountFormSection.style.display = 'block';
    document.getElementById('accountFormTitle').textContent = 'Add Account';
    document.getElementById('accountForm').reset();
});

cancelAccountBtn.addEventListener('click', () => {
    accountFormSection.style.display = 'none';
});

function loadDepartments() {
    const departments = window.db.departments;
    const tbody = document.getElementById('departmentsTableBody');
    
    if (departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">no departments.</td></tr>';
    } else {
        tbody.innerHTML = departments.map(dept => `
            <tr>
                <td>${dept.name}</td>
                <td>${dept.description}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editDepartment('${dept.name}')">edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDepartment('${dept.name}')">delete</button>
                </td>
            </tr>
        `).join('');
    }
}

function editDepartment(name) {
    const department = window.db.departments.find(dept => dept.name === name);
    
    if (department) {
        departmentFormSection.style.display = 'block';
        document.getElementById('departmentFormTitle').textContent = 'Edit Department';
        document.getElementById('deptName').value = department.name;
        document.getElementById('deptDescription').value = department.description;
        
        document.getElementById('deptName').setAttribute('readonly', true);
        document.getElementById('departmentForm').dataset.originalName = name;
    }
}

function loadAccounts() {
    const accounts = window.db.accounts;
    const tbody = document.getElementById('accountsTableBody');
    
    if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">no accounts.</td></tr>';
    } else {
        tbody.innerHTML = accounts.map(account => `
            <tr>
                <td>${account.firstName} ${account.lastName}</td>
                <td>${account.email}</td>
                <td>${account.role || 'User'}</td>
                <td>${account.verified ? '✅' : '❌'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editAccount('${account.email}')">edit</button>
                    <button class="btn btn-sm btn-warning" onclick="resetAccountPassword('${account.email}')">reset password</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAccount('${account.email}')">delete</button>
                </td>
            </tr>
        `).join('');
    }
}

document.getElementById('departmentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const department = {
        name: document.getElementById('deptName').value,
        description: document.getElementById('deptDescription').value
    };
    
    const originalName = document.getElementById('departmentForm').dataset.originalName;
    
    if (originalName) {
        const deptIndex = window.db.departments.findIndex(d => d.name === originalName);
        if (deptIndex !== -1) {
            window.db.departments[deptIndex] = department;
            showToast('department updated successfully', 'success');
        }
        delete document.getElementById('departmentForm').dataset.originalName;
        document.getElementById('deptName').removeAttribute('readonly');
    } else {
        const existingDept = window.db.departments.find(d => d.name === department.name);
        if (existingDept) {
            showToast('a department with this name already exists', 'error');
            return;
        }
        window.db.departments.push(department);
        showToast('department added successfully', 'success');
    }
    
    saveToStorage();
    departmentFormSection.style.display = 'none';
    document.getElementById('departmentForm').reset();
    loadDepartments();
});

document.getElementById('accountForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const password = document.getElementById('accPassword').value;
    
    if (password.length < 6) {
        showToast('password must be at least 6 characters long', 'error');
        return;
    }
    
    const account = {
        firstName: document.getElementById('accFirstName').value,
        lastName: document.getElementById('accLastName').value,
        email: document.getElementById('accEmail').value,
        password: password,
        role: document.getElementById('accRole').value,
        verified: document.getElementById('accVerified').checked
    };
    
    const originalEmail = document.getElementById('accountForm').dataset.originalEmail;
    
    if (originalEmail) {
        const accountIndex = window.db.accounts.findIndex(acc => acc.email === originalEmail);
        if (accountIndex !== -1) {
            window.db.accounts[accountIndex] = account;
            showToast('account updated successfully', 'success');
        }
        delete document.getElementById('accountForm').dataset.originalEmail;
    } else {
        const existingAccount = window.db.accounts.find(acc => acc.email === account.email);
        if (existingAccount) {
            showToast('an account with this email already exists', 'error');
            return;
        }
        window.db.accounts.push(account);
        showToast('account created successfully', 'success');
    }
    
    saveToStorage();
    accountFormSection.style.display = 'none';
    document.getElementById('accountForm').reset();
    loadAccounts();
});

function deleteDepartment(name) {
    if (confirm(`delete department "${name}"?`)) {
        window.db.departments = window.db.departments.filter(d => d.name !== name);
        saveToStorage();
        loadDepartments();
        showToast('department deleted successfully', 'success');
    }
}

function deleteAccount(email) {
    if (currentUser && email === currentUser.email) {
        showToast('you cannot delete your own account while logged in', 'warning');
        return;
    }
    
    if (confirm(`delete account "${email}"?`)) {
        window.db.accounts = window.db.accounts.filter(acc => acc.email !== email);
        saveToStorage();
        loadAccounts();
        showToast('account deleted successfully', 'success');
    }
}

function editAccount(email) {
    const account = window.db.accounts.find(acc => acc.email === email);
    
    if (account) {
        accountFormSection.style.display = 'block';
        document.getElementById('accountFormTitle').textContent = 'Edit Account';
        document.getElementById('accFirstName').value = account.firstName;
        document.getElementById('accLastName').value = account.lastName;
        document.getElementById('accEmail').value = account.email;
        document.getElementById('accPassword').value = account.password;
        document.getElementById('accRole').value = account.role || 'User';
        document.getElementById('accVerified').checked = account.verified;
        
        document.getElementById('accountForm').dataset.originalEmail = email;
    }
}

function resetAccountPassword(email) {
    const newPassword = prompt('enter new password for ' + email + ' (min 6 characters):');
    if (newPassword) {
        if (newPassword.length < 6) {
            showToast('password must be at least 6 characters long', 'error');
            return;
        }
        
        const accountIndex = window.db.accounts.findIndex(acc => acc.email === email);
        
        if (accountIndex !== -1) {
            window.db.accounts[accountIndex].password = newPassword;
            saveToStorage();
            showToast('password reset successfully!', 'success');
            loadAccounts();
        }
    }
}

resetPasswordBtn.addEventListener('click', () => {
    const email = document.getElementById('accEmail').value;
    if (email) {
        resetAccountPassword(email);
        accountFormSection.style.display = 'none';
    } else {
        showToast('please fill in the email field first', 'warning');
    }
});

myRequestsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/my-requests');
});

newRequestBtn.addEventListener('click', () => {
    requestModal.style.display = 'block';
});

createFirstRequestBtn.addEventListener('click', () => {
    requestModal.style.display = 'block';
});

closeRequestModal.addEventListener('click', () => {
    requestModal.style.display = 'none';
    requestForm.reset();
});

requestModal.addEventListener('click', (e) => {
    if (e.target === requestModal) {
        requestModal.style.display = 'none';
        requestForm.reset();
    }
});

function addRequestItem() {
    const itemsDiv = document.getElementById('requestItems');
    const newItem = document.createElement('div');
    newItem.className = 'input-group mb-2';
    newItem.innerHTML = `
        <input type="text" class="form-control" placeholder="item name" required>
        <input type="number" class="form-control" value="1" min="1" style="max-width: 80px;">
        <button type="button" class="btn btn-outline-danger" onclick="this.parentElement.remove()">×</button>
    `;
    itemsDiv.appendChild(newItem);
}

function loadMyRequests() {
    if (!currentUser) return;
    
    const myRequests = window.db.requests.filter(req => req.userEmail === currentUser.email);
    
    if (myRequests.length === 0) {
        noRequestsMessage.style.display = 'block';
        requestsTable.style.display = 'none';
    } else {
        noRequestsMessage.style.display = 'none';
        requestsTable.style.display = 'table';
        
        const tbody = document.getElementById('requestsTableBody');
        tbody.innerHTML = myRequests.map(req => `
            <tr>
                <td>${req.type}</td>
                <td>${req.items.map(item => `${item.name} (${item.quantity})`).join(', ')}</td>
                <td><span class="badge bg-${req.status === 'Pending' ? 'warning' : req.status === 'Approved' ? 'success' : 'danger'}">${req.status}</span></td>
                <td>${new Date(req.date).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewRequest('${req.id}')">view</button>
                    ${req.status === 'Pending' ? `<button class="btn btn-sm btn-danger" onclick="deleteRequest('${req.id}')">delete</button>` : ''}
                </td>
            </tr>
        `).join('');
    }
}

requestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const itemInputs = document.querySelectorAll('#requestItems .input-group');
    const items = Array.from(itemInputs).map(group => {
        const inputs = group.querySelectorAll('input');
        return {
            name: inputs[0].value,
            quantity: parseInt(inputs[1].value)
        };
    });
    
    const request = {
        id: Date.now().toString(),
        userEmail: currentUser.email,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        type: document.getElementById('requestType').value,
        items: items,
        status: 'Pending',
        date: new Date().toISOString()
    };
    
    window.db.requests.push(request);
    saveToStorage();
    
    requestModal.style.display = 'none';
    requestForm.reset();
    loadMyRequests();
    
    showToast('request submitted successfully!', 'success');
});

function viewRequest(id) {
    const request = window.db.requests.find(r => r.id === id);
    if (request) {
        alert(`request details:\ntype: ${request.type}\nitems: ${request.items.map(i => `${i.name} (${i.quantity})`).join(', ')}\nstatus: ${request.status}`);
    }
}

function deleteRequest(id) {
    if (confirm('delete this request?')) {
        window.db.requests = window.db.requests.filter(r => r.id !== id);
        saveToStorage();
        loadMyRequests();
        showToast('request deleted successfully', 'success');
    }
}

allRequestsLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('#/all-requests');
});

function loadAllRequests() {
    const allRequests = window.db.requests;
    const tbody = document.getElementById('allRequestsTableBody');
    
    if (allRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">no requests.</td></tr>';
    } else {
        tbody.innerHTML = allRequests.map(req => `
            <tr>
                <td>${req.userName}</td>
                <td>${req.type}</td>
                <td>${req.items.map(item => `${item.name} (${item.quantity})`).join(', ')}</td>
                <td><span class="badge bg-${req.status === 'Pending' ? 'warning' : req.status === 'Approved' ? 'success' : 'danger'}">${req.status}</span></td>
                <td>${new Date(req.date).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewRequest('${req.id}')">view</button>
                    ${req.status === 'Pending' ? `
                        <button class="btn btn-sm btn-success" onclick="approveRequest('${req.id}')">approve</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectRequest('${req.id}')">reject</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }
}

function approveRequest(id) {
    if (confirm('approve this request?')) {
        const requestIndex = window.db.requests.findIndex(r => r.id === id);
        if (requestIndex !== -1) {
            window.db.requests[requestIndex].status = 'Approved';
            saveToStorage();
            loadAllRequests();
            showToast('request approved', 'success');
        }
    }
}

function rejectRequest(id) {
    if (confirm('reject this request?')) {
        const requestIndex = window.db.requests.findIndex(r => r.id === id);
        if (requestIndex !== -1) {
            window.db.requests[requestIndex].status = 'Rejected';
            saveToStorage();
            loadAllRequests();
            showToast('request rejected', 'info');
        }
    }
}

window.addEventListener('load', () => {
    if (!window.location.hash) {
        window.location.hash = '#/';
    }
    
    const authToken = localStorage.getItem('auth_token');
    const loggedInUser = localStorage.getItem('loggedInUser');
    
    if (authToken && loggedInUser) {
        const user = JSON.parse(loggedInUser);
        setAuthState(true, user);
        showLoggedInNav(user);
    } else {
        setAuthState(false);
    }
    
    handleRouting();
});