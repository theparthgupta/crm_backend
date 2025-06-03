const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest' // Or a suitable model for text generation
});

/**
 * Generates a human-readable summary of a campaign's performance using AI.
 * @param {object} campaignStats - The campaign statistics.
 * @param {string} campaignStats.name - The campaign name.
 * @param {number} campaignStats.totalAudience - Total number of customers in the segment.
 * @param {number} campaignStats.sentCount - Number of messages successfully sent.
 * @param {number} campaignStats.failedCount - Number of messages failed to send.
 * @param {number} campaignStats.successRate - Percentage of successful deliveries.
 * @returns {Promise<string|null>} A promise that resolves with the summary text or null if an error occurs.
 */
async function generateCampaignSummary(campaignStats) {
  if (!apiKey) {
    console.error('GOOGLE_API_KEY not set. Cannot generate campaign summary.');
    return 'AI summary not available: API key missing.';
  }

  const prompt = `Generate a concise, human-readable summary of the following campaign's performance based on its statistics. Focus on key metrics like audience size, messages sent, and delivery success rate. Keep it under 100 words.

Campaign Name: ${campaignStats.name}
Total Audience: ${campaignStats.totalAudience}
Messages Sent Successfully: ${campaignStats.sentCount}
Messages Failed: ${campaignStats.failedCount}
Delivery Success Rate: ${campaignStats.successRate.toFixed(2)}%

Summary:`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error('Error generating AI campaign summary:', error);
    // Return a user-friendly message or indicate failure
    return 'Could not generate AI summary at this time.';
  }
}

/**
 * Converts a natural language description into a structured JSON object for segment rules.
 * Supported fields: totalSpend, visitCount, lastPurchase
 * Supported operators: >, <, =, >=, <=, since (for lastPurchase, value is date string)
 * Example rule structure: {"operator": "AND", "rules": [{"field": "totalSpend", "operator": ">=", "value": 5000}, {"operator": "OR", "rules": [{"field": "visitCount", "operator": "<", "value": 3}, {"field": "lastPurchase", "operator": "since", "value": "2023-01-01T00:00:00Z"}]}]}
 * 
 * @param {string} naturalLanguageQuery - The natural language description of the segment.
 * @returns {Promise<object|null>} A promise that resolves with the JSON rule object or null if generation fails.
 */
async function generateSegmentRules(naturalLanguageQuery) {
    if (!apiKey) {
      console.error('GOOGLE_API_KEY not set. Cannot generate segment rules.');
      return null;
    }

    const prompt = `Convert the following natural language description into a JSON object representing segment rules. 
Use the specified structure and supported fields/operators. The output should be a valid JSON object ONLY.

Supported fields: totalSpend, visitCount, lastPurchase
Supported operators: >, <, =, >=, <=, since (for lastPurchase, value is an ISO 8601 date string)

Rule Structure Example: 
{
  "operator": "AND" | "OR",
  "rules": [
    {
      "field": "string",    
      "operator": ">"|"<"|"="|">="|"<="|"since", 
      "value": "any"      
    }
    // Can nest groups: { "operator": "AND" | "OR", "rules": [...] }
  ]
}

Examples:
User: People who haven't shopped in 6 months and spent over ₹5K
JSON: {"operator": "AND", "rules": [{"field": "lastPurchase", "operator": "since", "value": "PAST_DATE_6_MONTHS_AGO_ISO"}, {"field": "totalSpend", "operator": ">", "value": 5000}]}

User: Customers who visited more than 5 times OR have total spend less than 1000
JSON: {"operator": "OR", "rules": [{"field": "visitCount", "operator": ">", "value": 5}, {"field": "totalSpend", "operator": "<", "value": 1000}]}

User: inactive for 90 days
JSON: {"operator": "AND", "rules": [{"field": "lastPurchase", "operator": "since", "value": "PAST_DATE_90_DAYS_AGO_ISO"}]}

User: total spend exactly 500
JSON: {"operator": "AND", "rules": [{"field": "totalSpend", "operator": "=", "value": 500}]}

Note: For 'since' operator, generate a placeholder 'PAST_DATE_..._ISO'. The backend will replace this with the actual date.

Convert this:
User: ${naturalLanguageQuery}
JSON:`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      // ** Add logging here **
      console.log('Raw AI response text:', text);
      console.log('Attempting to parse JSON from text...', text.substring(0, Math.min(text.length, 50)) + (text.length > 50 ? '...' : '')); // Log start of text
      
      // ** More robust fix: Extract content between the first and last curly braces {} **
      const jsonStartIndex = text.indexOf('{');
      const jsonEndIndex = text.lastIndexOf('}');

      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
          text = text.substring(jsonStartIndex, jsonEndIndex + 1);
      } else {
           // Fallback if curly braces not found (shouldn't happen with expected JSON)
           console.warn('Could not find JSON curly braces in AI response. Attempting to trim and parse full text.');
           text = text.trim();
      }
      
      console.log('Cleaned text before JSON.parse:', text.substring(0, Math.min(text.length, 50)) + (text.length > 50 ? '...' : '')); // Log cleaned text

      // The AI should return JSON text, try to parse it
      const rules = JSON.parse(text);
      return rules;
    } catch (error) {
      console.error('Error generating AI segment rules:', error);
      // Return null or a specific error indicator
      return null;
    }
}

module.exports = { generateCampaignSummary, generateSegmentRules }; 