// test-mail.js
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testMail() {
  console.log('--- Mail Configuration ---');
  console.log(`Host: ${process.env.MAIL_HOST}`);
  console.log(`Port: ${process.env.MAIL_PORT}`);
  console.log(`User: ${process.env.MAIL_USER}`);
  console.log(`Pass: ${process.env.MAIL_PASS ? '********' : 'NOT SET'}`);
  console.log('--------------------------');

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  try {
    console.log('Attempting to send test email...');
    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_USER}" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER, // Send to self
      subject: 'League Pro - SMTP Test',
      text: 'If you see this, your SMTP configuration is working!',
      html: '<b>If you see this, your SMTP configuration is working!</b>',
    });
    console.log('✅ Success! Message sent:', info.messageId);
  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(error);
  }
}

testMail();
