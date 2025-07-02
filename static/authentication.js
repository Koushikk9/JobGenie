// --- START OF FILE authentication.js (Corrected) ---
console.log("authentication loaded...")
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        
        // FIX: Use the loginForm to find the checked radio button
        const userType = loginForm.querySelector("input[name='user_type']:checked").value;

        try {
            // Using a relative URL is better than a hardcoded one
            const res = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    // FIX: Key is 'user_type' to match the corrected Python backend
                    user_type: userType 
                })
            });
            const data = await res.json();
            if (res.ok) {
                console.log("Login successful");
                // The server now provides the correct redirect URL
                window.location.href = data.redirect;
            } else {
                alert(data.message || "Login failed");
            }
        } catch (err) {
            console.log(err);
            alert("An error occurred. Please try again.");
        }
    });
}

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value;
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;
        const confirmPassword = document.getElementById("confirm_password").value;
        const userType = registerForm.querySelector("input[name='user_type']:checked").value;

        if (confirmPassword !== password) {
            alert("Passwords do not match");
            return;
        }

        try {
            const res = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    user_type: userType
                })
            });
            const data = await res.json();
            if (res.ok) {
                console.log("Registration successful! Redirecting...");
                window.location.href = data.redirect;
            } else {
                alert(data.message || "Registration failed");
            }
        } catch (err) {
            console.log(err);
            alert("An error occurred. Please try again.");
        }
    });
}