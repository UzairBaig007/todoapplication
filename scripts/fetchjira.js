// import fetch from "node-fetch";
// import dotenv from "dotenv";

// dotenv.config();

// const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
// const EMAIL = process.env.JIRA_EMAIL;
// const TOKEN = process.env.JIRA_API_TOKEN;

// // 👉 change this to your real ticket
// const ticketKey = "SCRUM-6";

// function extractTextFromADF(adf) {
//   let text = "";

//   function traverse(node) {
//     if (!node) return;

//     if (node.type === "text") {
//       text += node.text + " ";
//     }

//     if (node.content && Array.isArray(node.content)) {
//       node.content.forEach(traverse);
//     }
//   }

//   traverse(adf);
//   return text.trim();
// }

// async function getJiraTicket() {
//   const response = await fetch(
//     `${JIRA_DOMAIN}/rest/api/3/issue/${ticketKey}`,
//     {
//       method: "GET",
//       headers: {
//         Authorization:
//           "Basic " +
//           Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64"),
//         Accept: "application/json",
//       },
//     }
//   );

//   const data = await response.json();
//   const descriptionText = extractTextFromADF(data.fields.description);

//   console.log("TITLE:", data.fields.summary);
//   console.log("DESCRIPTION:", descriptionText);
// }

// getJiraTicket();