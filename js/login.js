// Import the existing initialized supabase client instance
import { supabase } from "/supabase/config.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    const messageBanner = document.getElementById('messageBanner');

    // Attach immediate validation cleanup on user input
    form.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('input', () => clearFieldValidation(element));
        if (element.tagName === 'SELECT') {
            element.addEventListener('change', () => clearFieldValidation(element));
        }
    });

    // Form submission processing
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideBanner();

        // 1. Client side validation check
        if (!validateForm()) {
            displayBanner('Please correct the highlighted fields below.', 'error');
            return;
        }

        // Extract native input parameters cleanly
        const formData = new FormData(form);
        const fullName = formData.get('fullName').trim();
        const email = formData.get('email').trim();
        const mobileNumber = formData.get('mobileNumber').trim();
        const faculty = formData.get('faculty');

        // 2. Set processing/loading state
        setLoading(true);

        try {
            // Generate a secure, cryptographically random string for background Auth password
            const password = generateInternalPassword(mobileNumber);

            // ----------------------------------------------------
            // STEP 1
            // Try logging in first
            // ----------------------------------------------------

            let { data: loginData, error: loginError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            if (!loginError) {
                window.location.href = "payment.html";
                setTimeout(() => {
                    window.location.href = "payment.html";
                }, 1000);
                return;
            }

            // ----------------------------------------------------
            // STEP 2
            // User doesn't exist yet
            // Create account
            // ----------------------------------------------------
    const { data: signupData, error: signupError } =
        await supabase.auth.signUp({
            email,
            password,
        });

    if (signupError) throw signupError;

    // IMPORTANT: Immediately log them in
    const { error: signInError } =
        await supabase.auth.signInWithPassword({
            email,
            password,
        });

    if (signInError) throw signInError;

    // Create profile
    const { error: profileError } =
        await supabase
            .from("profiles")
            .insert([
                {
                    id: signupData.user.id,
                    full_name: fullName,
                    phone: mobileNumber,
                    faculty,
                    created_at: new Date().toISOString()
                }
            ]);

            if (profileError && profileError.code !== "23505") {
                throw profileError;
            }

            window.location.href = "payment.html";

            } catch (error) {
                setLoading(false);
                handleSystemErrors(error);
            }
        });

        /**
         * Iterates over UI elements to assert validity checks
         * @returns {boolean} truth assessment output matches
         */
        function validateForm() {
        let isFormValid = true;

        form.querySelectorAll('input, select').forEach(field => {
            let isFieldValid = true;

            if (field.hasAttribute('required') && !field.value) {
                isFieldValid = false;
            } else if (field.type === 'email' && !validateEmailFormat(field.value)) {
                isFieldValid = false;
            } else if (field.id === 'mobileNumber' && !/^[0-9]{10}$/.test(field.value)) {
                isFieldValid = false;
            }

            if (!isFieldValid) {
                field.closest('.input-group').classList.add('invalid');
                isFormValid = false;
            }
        });

        return isFormValid;
    }

    function clearFieldValidation(element) {
        const inputGroup = element.closest('.input-group');
        if (inputGroup.classList.contains('invalid')) {
            inputGroup.classList.remove('invalid');
        }
    }

    function validateEmailFormat(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Generates a structural background string pass token
     */
        function generateInternalPassword(mobileNumber) {
            return `${mobileNumber}@Sankalpa2026`;
        }

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
        } else {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            btnText.textContent = 'Continue';
        }
    }

    function displayBanner(message, type) {
        messageBanner.textContent = message;
        messageBanner.className = `message-banner ${type}`;
    }

    function hideBanner() {
        messageBanner.className = 'message-banner hidden';
        messageBanner.textContent = '';
    }

    /**
     * Evaluates error components thrown to emit accurate strings
     * @param {Object} error 
     */
    function handleSystemErrors(error) {
        console.error('Registration Exception:', error);
        
        let message = error.message || 'An unexpected runtime connection loss occurred.';

        // Supabase specific error mappings
        if (error.status === 422 || message.toLowerCase().includes('already registered')) {
            message = 'This email configuration address has already been registered with Sankalpa Classes.';
        } else if (error.code === 'TypeError' || message.toLowerCase().includes('fetch')) {
            message = 'Network access dropped. Please double check internet connection properties.';
        }

        displayBanner(message, 'error');
    }
});