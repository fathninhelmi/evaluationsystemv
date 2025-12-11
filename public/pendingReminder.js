import { Client, Databases, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const users = new Users(client);

  const databaseId = "68ba8a9c001f17064e15";
  const postEvalCollectionId = "68bf9d62002b4f5f7f23";
  const mainCollectionId = "68ba918c0022d2b9a429";

  try {
    log("Starting pending reminder check...");
    
    const now = new Date();
    const currentDateStr = now.toISOString();
    const response = await databases.listDocuments(
      databaseId,
      postEvalCollectionId,
      [
        Query.equal('result', 'pending'),
        Query.equal('reminderSent', false),
        Query.lessThanEqual('reminderDate', currentDateStr)
      ]
    );

    log(`Found ${response.documents.length} forms requiring reminders`);

    for (const doc of response.documents) {
      try {
        const mainDoc = await databases.getDocument(
          databaseId,
          mainCollectionId,
          doc.$id
        );
        const userId = mainDoc.$permissions[0]?.split('"')[1] || mainDoc.$createdBy;
        let userEmail = '';
        let userName = '';
        
        try {
          const user = await users.get(userId);
          userEmail = user.email;
          userName = user.name || user.email;
        } catch (userError) {
          error(`Failed to get user details for ${userId}: ${userError.message}`);
          continue;
        }

        const emailSent = await sendReminderEmail(userEmail, userName, doc.$id, mainDoc);
        
        if (emailSent) {
          await databases.updateDocument(
            databaseId,
            postEvalCollectionId,
            doc.$id,
            {
              reminderSent: true,
              reminderSentDate: now.toISOString()
            }
          );
          
          log(`Reminder sent successfully for form ${doc.$id} to ${userEmail}`);
        }
      } catch (docError) {
        error(`Error processing form ${doc.$id}: ${docError.message}`);
      }
    }

    return res.json({
      success: true,
      processed: response.documents.length,
      message: `Processed ${response.documents.length} pending reminders`
    });

  } catch (err) {
    error(`Error in reminder function: ${err.message}`);
    return res.json({
      success: false,
      error: err.message
    }, 500);
  }
};

async function sendReminderEmail(userEmail, userName, formId, mainDoc) {
  
  const formLink = `https://your-domain.com/posteval.html?id=${formId}`;
  const customerName = mainDoc.customerName || 'N/A';
  const projectName = mainDoc.projectName || 'N/A';
  
  const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .info-box { background: white; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📋 Post Evaluation Form Reminder</h2>
        </div>
        <div class="content">
            <p>Hello ${userName},</p>
            
            <p>This is an automated reminder regarding your pending post-evaluation form in the Evaluation System.</p>
            
            <div class="info-box">
                <strong>Form Details:</strong><br>
                Customer: ${customerName}<br>
                Project: ${projectName}<br>
                Status: Pending (Set 2 weeks ago)
            </div>
            
            <p>It has been 14 days since you marked this form as "Pending". Please update the form with the final evaluation results (Win/Lose) and complete the required information.</p>
            
            <center>
                <a href="${formLink}" class="button">Update Form Now</a>
            </center>
            
            <p>You can access the form directly using the link above, or log into the Evaluation System and navigate to your pending forms.</p>
            
            <p>If you have any questions or need assistance, please contact your administrator.</p>
            
            <p>Best regards,<br>
            <strong>ViTrox Evaluation System</strong></p>
        </div>
        <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>© 2025 ViTrox. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: userEmail }],
          subject: '⏰ Reminder: Update Your Pending Post-Evaluation Form'
        }],
        from: { 
          email: 'noreply@vitrox.com',
          name: 'ViTrox Evaluation System'
        },
        content: [{
          type: 'text/html',
          value: emailHTML
        }]
      })
    });

    const messaging = new Messaging(client);
    await messaging.createEmail(
      'unique()',
      'Reminder: Update Your Pending Post-Evaluation Form',
      emailHTML,
      [],
      [userEmail]
    );

    console.log(`Would send email to: ${userEmail}`);
    console.log(`Form link: ${formLink}`);
    
    return true;
  } catch (emailError) {
    console.error(`Failed to send email to ${userEmail}:`, emailError);
    return false;
  }
}
