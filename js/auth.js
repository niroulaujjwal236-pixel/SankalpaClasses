import { supabase } from "../supabase/config.js";

export async function getCurrentUser() {

    const { data, error } = await supabase.auth.getUser();

    console.log("getUser() returned:", data);
    console.log("Error:", error);

    if (error) {
        return null;
    }

    return data.user;
}

export async function isLoggedIn() {
    const user = await getCurrentUser();

    console.log("Current User:", user);

    return user !== null;
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