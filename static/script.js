// static/script.js (Fixed Syntax Errors and Duplicates)

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    let url = "http://127.0.0.1:5000"
    const searchForm = document.querySelector(".search-form");
    if (searchForm) {
        searchForm.addEventListener("submit", performSearch);
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", handleAuthSubmit);
    }

    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", handleAuthSubmit);
    }

    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            toggleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentJobType = this.dataset.type;
        });
    });
});

// Global variables
let currentPage = 'home';
let searchResults = [];
let currentJobType = 'both';

async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const url = (form.id === 'login-form') ? '/login' : '/register';
    const submitBtn = form.querySelector("button[type='submit']");

    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    if (form.id === 'register-form' && body.password !== body.confirm_password) {
        alert("Passwords do not match.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (response.ok) {
            window.location.href = data.redirect || '/';
        } else {
            alert(data.message || 'An error occurred.');
        }
    } catch (error) {
        alert('A network error occurred. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = (form.id === 'login-form') ? 'Login' : 'Create Account';
    }
}

async function checkLoginStatus() {
    try {
        const response = await fetch('/api/session-status');
        if (!response.ok) return;
        const authData = await response.json();
        updateUIForAuthState(authData);
    } catch (error) {
        console.error("Could not check session status:", error);
    }
}

function updateUIForAuthState(authData) {
    const navLogin = document.getElementById('nav-login-link');
    const navRegister = document.getElementById('nav-register-link');
    const navPostJob = document.getElementById('nav-post-job-link');
    const navDashboard = document.getElementById('nav-dashboard-link');
    const navUsername = document.getElementById('nav-username');
    const navLogout = document.getElementById('nav-logout-link');

    const mobileNavLogin = document.getElementById('mobile-nav-login-link');
    const mobileNavRegister = document.getElementById('mobile-nav-register-link');
    const mobileNavPostJob = document.getElementById('mobile-nav-post-job-link');
    const mobileNavDashboard = document.getElementById('mobile-nav-dashboard-link');
    const mobileNavLogout = document.getElementById('mobile-nav-logout-link');

    const quickLinkPostJob = document.querySelector('.quick-link[onclick*="showPostJobModal"]');

    if (authData.logged_in) {
        // Hide login/register elements
        if (navLogin) navLogin.style.display = 'none';
        if (navRegister) navRegister.style.display = 'none';
        if (mobileNavLogin) mobileNavLogin.style.display = 'none';
        if (mobileNavRegister) mobileNavRegister.style.display = 'none';

        // Show authenticated user elements
        if (navDashboard) navDashboard.style.display = 'inline-block';
        if (navLogout) navLogout.style.display = 'inline-block';
        if (navUsername) {
            navUsername.style.display = 'inline-block';
            navUsername.textContent = `Hi, ${authData.username}`;
        }

        if (mobileNavDashboard) mobileNavDashboard.style.display = 'block';
        if (mobileNavLogout) mobileNavLogout.style.display = 'block';

        // Show recruiter-specific elements
        if (authData.user_type === 'recruiter') {
            if (navPostJob) navPostJob.style.display = 'inline-block';
            if (mobileNavPostJob) mobileNavPostJob.style.display = 'block';
            if (quickLinkPostJob) quickLinkPostJob.style.display = 'flex';
        } else {
            if (quickLinkPostJob) quickLinkPostJob.style.display = 'none';
            if (navPostJob) navPostJob.style.display = 'none';
            if (mobileNavPostJob) mobileNavPostJob.style.display = 'none';
        }
    } else {
        // Show login/register elements
        if (navLogin) navLogin.style.display = 'inline-block';
        if (navRegister) navRegister.style.display = 'inline-block';
        if (mobileNavLogin) mobileNavLogin.style.display = 'block';
        if (mobileNavRegister) mobileNavRegister.style.display = 'block';

        // Hide authenticated user elements
        if (navPostJob) navPostJob.style.display = 'none';
        if (navDashboard) navDashboard.style.display = 'none';
        if (navUsername) navUsername.style.display = 'none';
        if (navLogout) navLogout.style.display = 'none';

        if (mobileNavPostJob) mobileNavPostJob.style.display = 'none';
        if (mobileNavDashboard) mobileNavDashboard.style.display = 'none';
        if (mobileNavLogout) mobileNavLogout.style.display = 'none';

        if (quickLinkPostJob) quickLinkPostJob.style.display = 'none';
    }
}

function normalizeJobs(jobs) {
    if (!Array.isArray(jobs)) return [];
    return jobs.map(job => {
        // Handle ID field
        if (job._id && typeof job._id === 'object' && job._id.$oid) {
            job.id_str = job._id.$oid;
        } else if (job._id && typeof job._id === 'string') {
            job.id_str = job._id;
        } else if (job.id) {
            job.id_str = job.id;
        }

        // Normalize field names - try different possible field names
        const fieldMappings = {
            job_title: ['job_title', 'title', 'position', 'role', 'job_name'],
            company_name: ['company_name', 'company', 'employer', 'organization'],
            job_location: ['job_location', 'location', 'city', 'place', 'address'],
            job_type: ['job_type', 'type', 'employment_type', 'work_type'],
            salary: ['salary', 'pay', 'compensation', 'wage', 'package'],
            job_description: ['job_description', 'description', 'details', 'summary'],
            job_requirements: ['job_requirements', 'requirements', 'qualifications', 'skills'],
            posted_date: ['posted_date', 'date_posted', 'created_at', 'post_date']
        };

        // Apply field mappings
        for (const [standardField, possibleFields] of Object.entries(fieldMappings)) {
            if (!job[standardField]) {
                for (const field of possibleFields) {
                    if (job[field] && job[field] !== null && job[field] !== undefined) {
                        job[standardField] = job[field];
                        break;
                    }
                }
            }
        }

        return job;
    });
}

async function performSearch(event) {
    if (event) event.preventDefault();

    showPage('search-results');
    const container = document.getElementById('job-cards-container');
    const resultsCountEl = document.getElementById('results-count');
    
    if (resultsCountEl) resultsCountEl.textContent = 'Searching...';
    if (container) container.innerHTML = '<div class="loader"></div>';

    const whatInput = document.getElementById('whatInput');
    const whereInput = document.getElementById('whereInput');
    const remoteToggle = document.getElementById('remoteToggle');
    const activeToggle = document.querySelector('.job-type-toggles .toggle-btn.active');

    const whatQuery = whatInput ? whatInput.value.trim() : '';
    const whereQuery = whereInput ? whereInput.value.trim() : '';
    const isRemote = remoteToggle ? remoteToggle.checked : false;
    const jobType = activeToggle ? activeToggle.dataset.type : 'both';

    const params = new URLSearchParams({ 
        what: whatQuery, 
        where: whereQuery, 
        remote: isRemote, 
        type: jobType 
    });

    try {
        // ✅ Fetch response from backend
        const response = await fetch(`${url}api/jobs/search?${params.toString()}`);
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        
        // ✅ Parse backend response
        const data = await response.json();
        const jobs = data.jobs || [];

        // 🔍 Debug logs
        console.log('Backend response:', data);
        console.log('Extracted jobs:', jobs);

        // ✅ Normalize and display
        searchResults = normalizeJobs(jobs);
        displaySearchResults();

    } catch (error) {
        console.error('Search failed:', error);
        if (resultsCountEl) resultsCountEl.textContent = 'Error loading results.';
        if (container) container.innerHTML = '<p class="no-results-msg">Could not fetch jobs. Please try again later.</p>';
    }
}

function displaySearchResults() {
    const container = document.getElementById('job-cards-container');
    const countEl = document.getElementById('results-count');
    
    if (container) container.innerHTML = ''; // Clear previous results or loader

    if (!searchResults || searchResults.length === 0) {
        if (countEl) countEl.textContent = '0 jobs found';
        if (container) container.innerHTML = '<p class="no-results-msg">No jobs found matching your criteria.</p>';
        return;
    }
    
    if (countEl) countEl.textContent = `${searchResults.length} jobs found`;

    if (container) {
        container.innerHTML = searchResults.map(job => {
            // More flexible field access with better fallbacks
            const jobTitle = job.job_title || job.title || job.position || job.role || 'Job Position Available';
            const companyName = job.company_name || job.company || job.employer || 'Company';
            const location = job.job_location || job.location || job.city || 'Location';
            const jobType = job.job_type || job.type || job.employment_type || 'full-time';
            const salary = job.salary || job.pay || job.compensation || 'Salary negotiable';
            
            const jobTypeDisplay = jobType ? (jobType.charAt(0).toUpperCase() + jobType.slice(1)) : 'Full-time';
            
            // Enhanced date handling
            let postedDate = 'Recently posted';
            try {
                const dateField = job.posted_date || job.date_posted || job.created_at || job.post_date;
                if (dateField) {
                    let dateValue;
                    if (typeof dateField === 'object' && dateField.$date) {
                        dateValue = new Date(dateField.$date);
                    } else {
                        dateValue = new Date(dateField);
                    }
                    
                    if (!isNaN(dateValue.getTime())) {
                        postedDate = dateValue.toLocaleDateString();
                    }
                }
            } catch (error) {
                console.warn('Error parsing date for job:', job.id_str, error);
            }

            return `
                <div class="job-card" onclick="viewJobDetails('${job.id_str}')">
                    <div class="job-card-header">
                        <span class="job-type-label">🏢 ${jobTypeDisplay}</span>
                        <button class="save-job-btn" onclick="event.stopPropagation(); saveJob('${job.id_str}')" title="Save Job">
                            <i class="far fa-bookmark"></i>
                        </button>
                    </div>
                    <h3 class="job-title">${jobTitle}</h3>
                    <p class="job-company">${companyName}</p>
                    <div class="job-details">
                        <span><i class="fas fa-map-marker-alt"></i> ${location}</span>
                        <span><i class="fas fa-rupee-sign"></i> ${salary}</span>
                        <span><i class="fas fa-calendar-alt"></i> Posted: ${postedDate}</span>
                    </div>
                    <div class="job-actions">
                        <button class="btn-primary" onclick="event.stopPropagation(); applyToJob('${job.id_str}')">Apply Now</button>
                        <button class="btn-secondary" onclick="viewJobDetails('${job.id_str}')">View Details</button>
                    </div>
                </div>`;
        }).join('');
    }
}

async function searchByCategory(categoryName) {
    const container = document.getElementById('job-cards-container');
    if (container) container.innerHTML = `<p class="loading-text">Fetching jobs in ${categoryName}...</p>`;
    showPage('search-results');
    
    try {
        const response = await fetch(`/api/jobs/category/${encodeURIComponent(categoryName)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        let jobs = await response.json();
        searchResults = normalizeJobs(jobs);
        displaySearchResults();
    } catch (error) {
        console.error("Failed to fetch jobs by category:", error);
        if (container) container.innerHTML = '<p class="no-results">Could not load jobs. Please try again later.</p>';
    }
}

function searchTag(query) {
    const whatInput = document.getElementById('whatInput');
    const searchForm = document.querySelector('.search-form');
    
    if (whatInput) whatInput.value = query;
    if (searchForm) searchForm.dispatchEvent(new Event('submit'));
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.add('active');
    currentPage = pageId;
    window.scrollTo(0, 0);
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav) mobileNav.classList.remove('active');
}

function viewJobDetails(jobId) {
    const job = searchResults.find(j => j.id_str === jobId);
    if (!job) return;
    
    const jobDetailTitle = document.getElementById('job-detail-title');
    if (jobDetailTitle) jobDetailTitle.textContent = job.job_title;
    
    const metaContainer = document.querySelector('#job-details .job-meta');
    if (metaContainer) {
        const companyEl = metaContainer.querySelector('.company');
        const locationEl = metaContainer.querySelector('.location');
        const jobTypeBadge = metaContainer.querySelector('.job-type-badge');
        
        if (companyEl) companyEl.textContent = job.company_name;
        if (locationEl) locationEl.textContent = job.job_location;
        if (jobTypeBadge) jobTypeBadge.textContent = job.job_type;
    }
    
    const overviewEl = document.querySelector('#overview p');
    if (overviewEl) overviewEl.textContent = job.job_description || 'No description available.';

    const eligibilityEl = document.querySelector('#eligibility ul');
    if (eligibilityEl) eligibilityEl.innerHTML = `<li>${job.job_requirements || 'No requirements specified.'}</li>`;

    showPage('job-details');
    showTab('overview');
}

function toggleMobileMenu() {
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav) mobileNav.classList.toggle('active');
}

function showTab(tabId) {
    const tabContainer = document.querySelector('.job-detail-content');
    if (!tabContainer) return;
    
    tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabContainer.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    const clickedButton = tabContainer.querySelector(`[onclick="showTab('${tabId}')"]`);
    const paneToShow = document.getElementById(tabId);
    
    if (clickedButton) clickedButton.classList.add('active');
    if (paneToShow) paneToShow.classList.add('active');
}

function showDashTab(tabId) {
    document.querySelectorAll('.dash-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.dash-tab-pane').forEach(pane => pane.classList.remove('active'));
    
    const clickedButton = document.querySelector(`[onclick="showDashTab('${tabId}')"]`);
    const paneToShow = document.getElementById(tabId);
    
    if (clickedButton) clickedButton.classList.add('active');
    if (paneToShow) paneToShow.classList.add('active');
}

function saveJob(jobId) { 
    alert(`Job ${jobId} saved! (Demo)`); 
}

function applyToJob(jobId) { 
    alert(`Applying for job ${jobId}... (Demo)`); 
}

// Modal functionality
const modal = document.getElementById('auth-modal');
const backdrop = document.getElementById('auth-modal-backdrop');
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');

function openModal(viewToShow) {
    if (!modal || !backdrop) return;
    backdrop.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    showModalView(viewToShow);
}

function closeModal() {
    if (!modal || !backdrop) return;
    backdrop.classList.add('hidden');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

function showModalView(viewToShow) {
    if (!loginView || !registerView) return;
    if (viewToShow === 'login') {
        loginView.classList.remove('hidden');
        registerView.classList.add('hidden');
    } else {
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
    }
}