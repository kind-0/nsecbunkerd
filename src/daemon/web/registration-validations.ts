import prisma from "../../db";

export async function validateRegistration(request, record) {
    // validate username uniqueness
    const body = request.body;
    const { username, domain, email, password } = body;

    const userRecord = await prisma.user.findUnique({
        where: { username, domain }
    });

    if (userRecord) throw new Error("Username already exists. If this is your account, please login instead.");

    // validate password length
    if (password.length < 8) throw new Error("Password is too short");

    // validate email (if present)
    if (email) {
        if (!email.includes("@")) throw new Error("Invalid email address");

        // validate email uniqueness (if one was provided)
        const emailRecord = await prisma.user.findFirst({ where: { email } });
        if (emailRecord) throw new Error("Email already exists");
    }
}