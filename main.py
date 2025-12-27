from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pypdf import PdfReader
import io
import json
import re

app = FastAPI()

# --- PASTE YOUR GROQ API KEY HERE ---
# Get API key from environment variable (more secure)
API_KEY = os.getenv("GROQ_API_KEY",)

client = Groq(api_key=API_KEY)

# Update CORS to allow your frontend domain
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],  # In production, replace with your actual frontend URL
    allow_methods=["*"], 
    allow_headers=["*"],
)

client = Groq(api_key=API_KEY)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

SYSTEM_PROMPT = """You are an expert exam paper parser. Parse COMPLETE PDF into perfectly structured JSON.

🔴 CRITICAL PARSING RULES - READ CAREFULLY:

1. **EXTRACT EVERYTHING - NO TRUNCATION**:
   - Read from first page to last page
   - Every single question must be in the output
   - Every option, every sub-question, every word
   - DO NOT summarize or compress content
   - DO NOT skip any questions

2. **CONTEXT/PASSAGES/POEMS - EXACT EXTRACTION**:
   - ANY text that appears BEFORE a question = `context` field
   - Preserve EXACT line breaks for poems (use \\n)
   - Keep paragraph breaks for passages
   - Include the FULL poem/passage text, not summary
   - Example context: Full poem verses, full story paragraphs, full extracts

3. **MCQ OPTIONS - EXTRACT ALL**:
   - Find options: (a), (b), (c), (d) OR A, B, C, D OR 1, 2, 3, 4
   - Each option = separate string in `options` array
   - Include the prefix: ["(a) Option text", "(b) Option text"]
   - Extract FULL option text, not shortened versions

4. **OR QUESTIONS - VERY IMPORTANT**:
   - Question says "Answer any ONE" or "Attempt A OR B" or "Do (A) OR (B)"
   - Put BOTH complete choices in `options` array
   - Format: ["(A) Full first choice question...", "(B) Full second choice question..."]
   - The main question text should be instruction like "Answer any ONE of the following:"
   - DO NOT put one choice as main question and other as option

5. **TABLES - PRESERVE STRUCTURE**:
   - Convert to text format with | separators
   - Example: "Error | Correction\\ngo | goes\\nwas | were"
   - Keep all rows and columns

6. **ERROR-CORRECTION TABLES** (Very Common):
   - Format as: "Error | Correction\\n[word] | [correction]"
   - Or describe: "Identify error and correction for: [sentence]"

7. **SUB-QUESTIONS WITH OPTIONS**:
   - If a sub-question has MCQ options, those go in sub_question's `options` field
   - Example structure:
   ```
   {
     "number": "3",
     "text": "Complete ANY TEN of twelve tasks:",
     "sub_questions": [
       {
         "number": "i",
         "text": "Supply correct form: The train ___ (arrive) late",
         "marks": "1",
         "options": []
       },
       {
         "number": "iv",
         "text": "Select correct option:",
         "marks": "1",
         "options": [
           "(A) he submits it yesterday",
           "(B) he had submitted it the previous day",
           "(C) he has submitted it on yesterday",
           "(D) he submitted it on previous day"
         ]
       }
     ]
   }
   ```

8. **EXTRACT PASSAGES FOR LITERATURE QUESTIONS**:
   - Q6, Q7 often have poetry/prose extracts
   - Put the FULL extract in `context` field
   - Example: "Two roads diverged in a yellow wood,\\nAnd sorry I could not travel both..."

9. **IGNORE ONLY JUNK**:
   - Remove: "CLICK HERE TO BUY", "Educart", "Amazon links"
   - Remove: Repeated page headers/footers
   - KEEP: All question content, all instructions, all examples

10. **QUESTION NUMBERING**:
    - Use EXACT numbers from PDF: "Q1", "1", "Q.1", "(i)", "a)"
    - Don't renumber

JSON STRUCTURE:
{
  "header": {
    "school": "Full School Name",
    "examName": "Full Exam Name",
    "time": "3 Hours",
    "marks": "80"
  },
  "sections": [
    {
      "title": "Section A: Reading",
      "questions": [
        {
          "number": "1",
          "text": "Full main question text",
          "marks": "10",
          "context": "Full passage/poem with \\n for line breaks",
          "sub_questions": [
            {
              "number": "i",
              "text": "Full sub-question text",
              "marks": "1",
              "options": ["(a) Option 1", "(b) Option 2"]
            }
          ],
          "options": ["(A) Choice 1 full text", "(B) Choice 2 full text"]
        }
      ]
    }
  ]
}

VALIDATION BEFORE RESPONDING:
✓ Did I extract ALL questions from ALL pages?
✓ Are poems/passages COMPLETE with line breaks?
✓ Are ALL MCQ options included with full text?
✓ Are OR questions structured correctly?
✓ Are sub-questions with options handled correctly?
✓ Did I remove only junk, keeping all questions?

EXTRACT EVERYTHING. COMPRESS NOTHING. This is critical for exam integrity."""

def clean_text(text):
    """Remove only advertisements and junk, keep all questions"""
    junk_patterns = [
        r'CLICK HERE TO BUY.*?https://[^\n]+',
        r'https://amzn\.to/[^\s]+',
        r'EDUCART BOOKS ON AMAZON[^\n]*',
        r'View.*?Book.*?\n',
    ]
    
    for pattern in junk_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Clean up extra whitespace but preserve structure
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def extract_structured_text(pdf_content):
    """Extract text with better structure preservation"""
    reader = PdfReader(io.BytesIO(pdf_content))
    pages = []
    
    for i, page in enumerate(reader.pages):
        raw_text = page.extract_text()
        cleaned = clean_text(raw_text)
        pages.append(f"\n{'='*70}\n📄 PAGE {i+1}\n{'='*70}\n{cleaned}")
    
    return "\n".join(pages)

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        content = await file.read()
        
        # Extract structured text
        full_text = extract_structured_text(content)
        
        print(f"Extracted {len(full_text)} characters from PDF")
        
        # Call Groq API with enhanced prompt
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user", 
                    "content": f"""Parse this COMPLETE exam paper. Follow all rules strictly:

{full_text}

🔴 CRITICAL REMINDERS:
1. Extract EVERY question - no truncation
2. Full passages/poems in 'context' with \\n line breaks
3. ALL MCQ options with complete text
4. OR questions: both choices in 'options' array
5. Sub-questions with their own options if they have MCQs
6. Literature extracts (poems/prose) in 'context'
7. Tables in readable text format
8. Remove only ads, keep ALL questions

Parse NOW with complete accuracy:"""
                }
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.02,  # Even lower for maximum consistency
            max_tokens=32000,  # Maximum for llama-3.3-70b
            response_format={"type": "json_object"}
        )
        
        response_text = chat_completion.choices[0].message.content
        print(f"Received {len(response_text)} characters from Groq")
        
        parsed_data = json.loads(response_text)
        
        # Post-processing validation and cleanup
        if not parsed_data.get("sections"):
            return {
                "header": {"school": "Parsing Error", "examName": "No sections found", "time": "N/A", "marks": "0"},
                "sections": []
            }
        
        # Ensure all required fields exist and handle sub-questions with options
        for section in parsed_data["sections"]:
            for question in section.get("questions", []):
                # Initialize arrays if missing
                if "sub_questions" not in question:
                    question["sub_questions"] = []
                if "options" not in question:
                    question["options"] = []
                if "context" not in question:
                    question["context"] = None
                if "image" not in question:
                    question["image"] = None
                    
                # Handle sub-questions
                for sub_q in question.get("sub_questions", []):
                    if "options" not in sub_q:
                        sub_q["options"] = []
                    if "marks" not in sub_q:
                        sub_q["marks"] = "1"
        
        print(f"Parsed {len(parsed_data['sections'])} sections successfully")
        return parsed_data

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "header": {
                "school": "Error Occurred",
                "examName": str(e)[:100],
                "time": "N/A",
                "marks": "0"
            },
            "sections": []
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)