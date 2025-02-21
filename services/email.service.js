const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, text }) => {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      text
    });
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

module.exports = { sendEmail }; 