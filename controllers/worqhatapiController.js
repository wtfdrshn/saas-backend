const axios = require('axios');

const generateDescription = async (req, res) => {
    const { prompt } = req.body;
    const STRINGPROMPT = "Below are the requirements and details for an event. your task is to design an description for the event. IMPORTANT: JUST RETURN THE DESCRIPTION NOTHING BEFORE OR AFTER IT Details: " + prompt 
    try {
      const response = await axios.post('https://api.worqhat.com/api/ai/content/v4', {
        question: STRINGPROMPT,
        model: 'aicon-v4-large-160824', 
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.WORQHAT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(response.data.content, 'RESPONSE');
      res.json({ description: response.data.content });
    } catch (error) {
      console.error('Error generating description:', error);
      res.status(500).json({ error: 'Failed to generate description' });
    }
};

module.exports = { generateDescription };