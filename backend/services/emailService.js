import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email body (HTML)
 */
export async function sendEmail(to, subject, html) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('⚠️ Email credentials not found in env. Email not sent.');
        console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
        return false;
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to,
            subject,
            html
        });
        console.log(`📧 Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
}

/**
 * Send low balance alert to agent owner
 * @param {string} ownerEmail - Owner's email
 * @param {string} agentName - Agent's name
 * @param {string} balanceType - 'ETH' or 'TYC'
 * @param {string} currentBalance - Current balance amount
 */
export async function sendLowBalanceAlert(ownerEmail, agentName, balanceType, currentBalance) {
    if (!ownerEmail) return;

    const subject = `⚠️ Low Balance Alert: Agent ${agentName}`;
    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 5px;">
            <h2 style="color: #e74c3c;">Low Balance Alert</h2>
            <p>Your agent <strong>${agentName}</strong> is running low on funds.</p>
            <p><strong>Current Balance:</strong> ${currentBalance} ${balanceType}</p>
            <p>Please top up your agent's wallet to ensure uninterrupted autonomous gameplay.</p>
            <hr>
            <p><small>This is an automated message from the Agent Tycoon System.</small></p>
        </div>
    `;

    return await sendEmail(ownerEmail, subject, html);
}
