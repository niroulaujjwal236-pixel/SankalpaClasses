import { supabase } from "/supabase/config.js";

export async function getCurrentUser() {

    const {
        data: { session }
    } = await supabase.auth.getSession();

    if (!session) return null;

    return session.user;
}

export async function isLoggedIn() {
    const { data: { session } } = await supabase.auth.getSession();
    return session !== null;
}

export async function getProfile() {
    const user = await getCurrentUser();

    if (!user) return null;

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Error loading profile:", error);
        return null;
    }

    return data;
}

export async function hasPaid() {
    const profile = await getProfile();

    if (!profile) return false;

    return profile.paid === true;
}

export async function logout() {
    await supabase.auth.signOut();

    window.location.href = "../index.html";
}