const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AITutorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.conversationMemory = new Map();
    this.contextWindow = 10; // Keep last 10 messages
  }

  // ========== ADVANCED CONTEXT MEMORY ==========
  async getResponse(userId, query, context = {}) {
    try {
      // Get conversation history
      const history = this.getConversationHistory(userId);
      
      // Build context with medical knowledge
      const systemPrompt = this.buildMedicalPrompt(context);
      
      // Try OpenAI first, fallback to Gemini
      let response;
      try {
        response = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: query }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        });
        response = response.choices[0].message.content;
      } catch (openaiError) {
        console.log('OpenAI failed, falling back to Gemini');
        const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(
          `${systemPrompt}\n\nUser: ${query}\nAssistant:`
        );
        response = result.response.text();
      }

      // Save to memory
      this.saveConversation(userId, query, response);
      
      // Generate follow-up questions
      const followUps = await this.generateFollowUp(userId, query, response);
      
      return {
        response,
        followUps,
        confidence: this.calculateConfidence(response),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('AI Tutor Error:', error);
      throw new Error('AI Tutor service unavailable');
    }
  }

  // ========== MEDICAL KNOWLEDGE PROMPT ==========
  buildMedicalPrompt(context) {
    return `
You are Medsathu AI Tutor - a world-class medical education assistant for MBBS students.

CONTEXT:
- Student Year: ${context.year || 'Unknown'}
- Subject: ${context.subject || 'General Medicine'}
- Current Topic: ${context.topic || 'General'}
- Exam Type: ${context.examType || 'NEET PG'}

RULES:
1. Always provide evidence-based medical information
2. Use standard medical terminology with explanations
3. Reference latest guidelines (NEET PG, USMLE, NMC)
4. If unsure, say "I recommend consulting a professor"
5. Format responses in bullet points for clarity
6. Include mnemonics where applicable
7. Suggest study resources when relevant

STYLE:
- Professional but friendly
- Encouraging and supportive
- Clear and concise explanations
- Real-world clinical correlations
- Include exam tips and high-yield points
`;
  }

  // ========== CONVERSATION MEMORY ==========
  getConversationHistory(userId) {
    const history = this.conversationMemory.get(userId) || [];
    return history.slice(-this.contextWindow);
  }

  saveConversation(userId, query, response) {
    if (!this.conversationMemory.has(userId)) {
      this.conversationMemory.set(userId, []);
    }
    const history = this.conversationMemory.get(userId);
    history.push(
      { role: 'user', content: query },
      { role: 'assistant', content: response }
    );
    // Keep only last 20 messages
    if (history.length > 20) {
      this.conversationMemory.set(userId, history.slice(-20));
    }
  }

  // ========== SMART FOLLOW-UP GENERATION ==========
  async generateFollowUp(userId, query, response) {
    try {
      const followUpPrompt = `
Based on this medical Q&A:
Q: ${query}
A: ${response}

Generate 3 relevant follow-up questions a medical student might ask next.
Return as JSON array.
`;
      const result = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: followUpPrompt }],
        temperature: 0.5,
        max_tokens: 200,
      });
      
      return JSON.parse(result.choices[0].message.content);
    } catch (error) {
      return [
        'Can you explain more about the mechanism?',
        'What are the clinical correlations?',
        'How is this tested in NEET PG?'
      ];
    }
  }

  // ========== CONFIDENCE SCORING ==========
  calculateConfidence(response) {
    const indicators = {
      high: ['according to', 'guidelines', 'studies show', 'evidence-based'],
      medium: ['typically', 'commonly', 'usually', 'often'],
      low: ['maybe', 'possibly', 'could be', 'might']
    };
    
    let score = 0;
    const text = response.toLowerCase();
    
    indicators.high.forEach(word => {
      if (text.includes(word)) score += 0.4;
    });
    indicators.medium.forEach(word => {
      if (text.includes(word)) score += 0.2;
    });
    indicators.low.forEach(word => {
      if (text.includes(word)) score -= 0.2;
    });
    
    return Math.min(Math.max(score, 0), 1);
  }
}

module.exports = new AITutorService();