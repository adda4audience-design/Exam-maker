import React, { useState, useRef } from 'react';
import { Printer, Edit2, Check, RefreshCcw, Image, Trash2, UploadCloud, FileDown, Plus, X } from 'lucide-react';
import Latex from 'react-latex-next';

const PrintStyles = () => (
  <style>{`
    @media print {
      @page { size: A4; margin: 0; } 
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; font-family: Calibri, sans-serif; }
      .no-print { display: none !important; }
      .paper-canvas { width: 100% !important; border: none !important; box-shadow: none !important; padding: 15mm !important; }
      textarea { border: none !important; background: transparent !important; resize: none; overflow: hidden; }
    }
    .paper-canvas {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      margin: 20px auto;
      background: white;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      border: 1px solid #ddd;
      font-family: Calibri, sans-serif;
    }
  `}</style>
);

const RenderText = ({ text }) => {
  if (!text) return null;
  // Add line breaks after colons
  const textWithBreaks = text.replace(/:\s*/g, ':\n');
  return (
    <div className="latex-container whitespace-pre-wrap leading-relaxed text-justify">
      <Latex delimiterMode="inline">{textWithBreaks}</Latex>
    </div>
  );
};

function App() {
  const [examData, setExamData] = useState(null);
  const [view, setView] = useState('input'); 
  const [isEditing, setIsEditing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const componentRef = useRef();

  const DEFAULT_HEADER = { school: "SCHOOL NAME", examName: "EXAMINATION", time: "3 Hours", marks: "80", instructions: "" };

  const handleDownloadWord = () => {
    if (!componentRef.current) return;
    const content = componentRef.current.innerHTML;
    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Exam Paper</title><style>table{border-collapse:collapse;width:100%;}td,th{border:1px solid black;padding:5px;} .no-print{display:none;}</style></head><body>`;
    const postHtml = "</body></html>";
    const blob = new Blob(['\ufeff', preHtml + content + postHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = 'exam_paper.doc';
    downloadLink.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("http://localhost:8000/upload-pdf", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Backend Error");
      const data = await response.json();
      setExamData({ header: { ...DEFAULT_HEADER, ...data.header }, sections: data.sections || [] }); 
      setView('editor');
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateHeader = (field, value) => setExamData(prev => ({ ...prev, header: { ...prev.header, [field]: value } }));
  
  const updateQuestion = (sIdx, qIdx, field, value) => {
    const newSections = [...examData.sections];
    newSections[sIdx].questions[qIdx][field] = value;
    setExamData({ ...examData, sections: newSections });
  };
  
  const updateSubQuestion = (sIdx, qIdx, subIdx, field, value) => {
    const newSections = [...examData.sections];
    newSections[sIdx].questions[qIdx].sub_questions[subIdx][field] = value;
    setExamData({ ...examData, sections: newSections });
  };

  const updateOption = (sIdx, qIdx, optIdx, value) => {
    const newSections = [...examData.sections];
    newSections[sIdx].questions[qIdx].options[optIdx] = value;
    setExamData({ ...examData, sections: newSections });
  };

  const deleteOption = (sIdx, qIdx, optIdx) => {
    const newSections = [...examData.sections];
    newSections[sIdx].questions[qIdx].options.splice(optIdx, 1);
    setExamData({ ...examData, sections: newSections });
  };

  const addOption = (sIdx, qIdx) => {
    const newSections = [...examData.sections];
    if (!newSections[sIdx].questions[qIdx].options) {
      newSections[sIdx].questions[qIdx].options = [];
    }
    newSections[sIdx].questions[qIdx].options.push("New option");
    setExamData({ ...examData, sections: newSections });
  };

  const deleteSubQuestion = (sIdx, qIdx, subIdx) => {
    const newSections = [...examData.sections];
    newSections[sIdx].questions[qIdx].sub_questions.splice(subIdx, 1);
    setExamData({ ...examData, sections: newSections });
  };

  const addSubQuestion = (sIdx, qIdx) => {
    const newSections = [...examData.sections];
    if (!newSections[sIdx].questions[qIdx].sub_questions) {
      newSections[sIdx].questions[qIdx].sub_questions = [];
    }
    const nextNum = String.fromCharCode(97 + newSections[sIdx].questions[qIdx].sub_questions.length);
    newSections[sIdx].questions[qIdx].sub_questions.push({
      number: nextNum,
      text: "New sub-question",
      marks: "1"
    });
    setExamData({ ...examData, sections: newSections });
  };

  const deleteQuestion = (sIdx, qIdx) => {
    const newSections = [...examData.sections];
    newSections[sIdx].questions.splice(qIdx, 1);
    setExamData({ ...examData, sections: newSections });
  };

  const addQuestion = (sIdx) => {
    const newSections = [...examData.sections];
    const lastQ = newSections[sIdx].questions[newSections[sIdx].questions.length - 1];
    const nextNum = lastQ ? String(parseInt(lastQ.number) + 1) : "1";
    newSections[sIdx].questions.push({
      number: nextNum,
      text: "New question",
      marks: "1",
      sub_questions: [],
      options: [],
      order: ['context', 'text', 'image', 'options', 'sub_questions']
    });
    setExamData({ ...examData, sections: newSections });
  };

  const addOrQuestion = (sIdx) => {
    const newSections = [...examData.sections];
    const lastQ = newSections[sIdx].questions[newSections[sIdx].questions.length - 1];
    const nextNum = lastQ ? String(parseInt(lastQ.number) + 1) : "1";
    newSections[sIdx].questions.push({
      number: nextNum,
      text: "Answer any ONE of the following:",
      marks: "5",
      sub_questions: [],
      options: [
        "(A) First choice question here...",
        "(B) Second choice question here..."
      ],
      order: ['text', 'options', 'context', 'image', 'sub_questions']
    });
    setExamData({ ...examData, sections: newSections });
  };

  const deleteSection = (sIdx) => {
    const newSections = [...examData.sections];
    newSections.splice(sIdx, 1);
    setExamData({ ...examData, sections: newSections });
  };

  const addSection = () => {
    const newSections = [...examData.sections];
    newSections.push({
      title: "NEW SECTION",
      questions: []
    });
    setExamData({ ...examData, sections: newSections });
  };

  const updateSectionTitle = (sIdx, value) => {
    const newSections = [...examData.sections];
    newSections[sIdx].title = value;
    setExamData({ ...examData, sections: newSections });
  };

  const handleImageUpload = (sIdx, qIdx, event) => {
    const file = event.target.files[0];
    if (file) updateQuestion(sIdx, qIdx, 'image', URL.createObjectURL(file));
  };

  const deleteImage = (sIdx, qIdx) => {
    updateQuestion(sIdx, qIdx, 'image', null);
  };

  const updateContext = (sIdx, qIdx, value) => {
    updateQuestion(sIdx, qIdx, 'context', value);
  };

  const deleteContext = (sIdx, qIdx) => {
    updateQuestion(sIdx, qIdx, 'context', null);
  };

  const addContext = (sIdx, qIdx) => {
    updateQuestion(sIdx, qIdx, 'context', 'Add context/passage here...');
  };

  // Drag and drop handlers
  const handleDragStart = (e, itemType, sIdx, qIdx) => {
    setDraggedItem({ type: itemType, sIdx, qIdx });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetType, sIdx, qIdx) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.sIdx !== sIdx || draggedItem.qIdx !== qIdx) return;
    
    const newSections = [...examData.sections];
    const question = newSections[sIdx].questions[qIdx];
    
    // Initialize order if not present
    if (!question.order) {
      question.order = ['context', 'text', 'image', 'options', 'sub_questions'];
    }
    
    const currentOrder = [...question.order];
    const draggedIndex = currentOrder.indexOf(draggedItem.type);
    const targetIndex = currentOrder.indexOf(targetType);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Swap positions
      [currentOrder[draggedIndex], currentOrder[targetIndex]] = [currentOrder[targetIndex], currentOrder[draggedIndex]];
      question.order = currentOrder;
      setExamData({ ...examData, sections: newSections });
    }
    
    setDraggedItem(null);
  };

  // Component renderer based on order
  const renderQuestionElement = (elementType, sIdx, qIdx, q) => {
    const isDragging = draggedItem?.type === elementType && draggedItem?.sIdx === sIdx && draggedItem?.qIdx === qIdx;
    const dragClass = isDragging ? 'opacity-50' : '';
    
    switch(elementType) {
      case 'context':
        if (!q.context) return null;
        return (
          <div 
            key="context"
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, 'context', sIdx, qIdx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'context', sIdx, qIdx)}
            className={`mb-4 p-4 bg-gray-50 border border-gray-300 rounded relative ${dragClass} ${isEditing ? 'cursor-move' : ''}`}
          >
            {isEditing && (
              <button 
                onClick={() => deleteContext(sIdx, qIdx)} 
                className="no-print absolute top-2 right-2 text-red-600 hover:text-red-800 z-10"
              >
                <X size={16}/>
              </button>
            )}
            {isEditing ? (
              <textarea 
                className="w-full border p-2 rounded bg-white text-sm font-sans italic" 
                rows={6} 
                value={q.context} 
                onChange={(e)=>updateContext(sIdx, qIdx, e.target.value)}
                placeholder="Context/Passage/Poem"
              />
            ) : (
              <div className="italic text-sm">
                <RenderText text={q.context} />
              </div>
            )}
          </div>
        );
      
      case 'text':
        return (
          <div 
            key="text"
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, 'text', sIdx, qIdx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'text', sIdx, qIdx)}
            className={`mb-3 relative ${dragClass} ${isEditing ? 'cursor-move' : ''}`}
          >
            {isEditing && (
              <button 
                onClick={() => deleteQuestion(sIdx, qIdx)} 
                className="no-print absolute -top-2 -right-2 text-red-600 hover:text-red-800 bg-white rounded-full p-1 shadow z-10"
              >
                <Trash2 size={14}/>
              </button>
            )}
            {isEditing ? (
              <textarea 
                className="w-full border p-2 rounded bg-white text-sm" 
                rows={3} 
                value={q.text} 
                onChange={(e)=>updateQuestion(sIdx, qIdx, 'text', e.target.value)}
              />
            ) : (
              <RenderText text={q.text}/>
            )}
          </div>
        );
      
      case 'image':
        if (!q.image) return null;
        return (
          <div 
            key="image"
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, 'image', sIdx, qIdx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'image', sIdx, qIdx)}
            className={`my-3 flex justify-center relative ${dragClass} ${isEditing ? 'cursor-move' : ''}`}
          >
            <img src={q.image} className="max-h-60 border p-1 bg-white shadow-sm" alt="Question diagram"/>
            {isEditing && (
              <button 
                onClick={() => deleteImage(sIdx, qIdx)}
                className="no-print absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 z-10"
              >
                <X size={14}/>
              </button>
            )}
          </div>
        );
      
      case 'options':
        if (!q.options || q.options.length === 0) return null;
        return (
          <div 
            key="options"
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, 'options', sIdx, qIdx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'options', sIdx, qIdx)}
            className={`mt-3 ${q.options.length === 2 && q.options.some(opt => opt.length > 100) ? 'space-y-3' : q.options.some(opt => opt.length > 50) ? 'space-y-2' : 'grid grid-cols-2 gap-3'} ${dragClass} ${isEditing ? 'cursor-move' : ''}`}
          >
            {q.options.map((opt, i) => (
              <div key={i} className={`${q.options.length === 2 && q.options.some(opt => opt.length > 100) ? 'border-l-4 border-blue-300 pl-3 py-2' : 'p-1'} relative`}>
                {isEditing ? (
                  <div className="flex items-start gap-2">
                    <textarea 
                      className="flex-grow border p-2 rounded text-sm bg-white" 
                      rows={opt.length > 100 ? 4 : 2}
                      value={opt} 
                      onChange={(e)=>updateOption(sIdx, qIdx, i, e.target.value)}
                    />
                    <button 
                      onClick={() => deleteOption(sIdx, qIdx, i)}
                      className="no-print text-red-600 hover:text-red-800"
                    >
                      <X size={14}/>
                    </button>
                  </div>
                ) : (
                  <div className={q.options.length === 2 && opt.length > 100 ? 'font-medium' : ''}>
                    <RenderText text={opt}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      
      case 'sub_questions':
        if (!q.sub_questions || q.sub_questions.length === 0) return null;
        return (
          <div 
            key="sub_questions"
            draggable={isEditing}
            onDragStart={(e) => handleDragStart(e, 'sub_questions', sIdx, qIdx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'sub_questions', sIdx, qIdx)}
            className={`${dragClass} ${isEditing ? 'cursor-move' : ''}`}
          >
            {q.sub_questions.map((sub, subIdx) => (
              <div key={subIdx} className="mb-3 text-sm border-l-2 border-gray-200 pl-3">
                <div className="flex gap-3 items-start relative mb-1">
                  <span className="font-bold min-w-[30px] text-right pt-1">
                    {isEditing ? (
                      <input 
                        className="w-8 text-right outline-none border-b bg-transparent" 
                        value={sub.number} 
                        onChange={(e)=>updateSubQuestion(sIdx, qIdx, subIdx, 'number', e.target.value)}
                      />
                    ) : sub.number}.
                  </span>
                  <div className="flex-grow">
                    {isEditing ? (
                      <textarea 
                        className="w-full border-b bg-transparent" 
                        rows={2} 
                        value={sub.text} 
                        onChange={(e)=>updateSubQuestion(sIdx, qIdx, subIdx, 'text', e.target.value)}
                      />
                    ) : (
                      <RenderText text={sub.text}/>
                    )}
                  </div>
                  <span className="min-w-[40px] text-right pt-1">
                    [{isEditing ? (
                      <input 
                        className="w-8 text-center outline-none border-b bg-transparent" 
                        value={sub.marks} 
                        onChange={(e)=>updateSubQuestion(sIdx, qIdx, subIdx, 'marks', e.target.value)}
                      />
                    ) : sub.marks}]
                  </span>
                  {isEditing && (
                    <button 
                      onClick={() => deleteSubQuestion(sIdx, qIdx, subIdx)}
                      className="no-print text-red-600 hover:text-red-800 pt-1"
                    >
                      <X size={14}/>
                    </button>
                  )}
                </div>
                {sub.options?.length > 0 && (
                  <div className="ml-10 mt-2 space-y-1">
                    {sub.options.map((opt, optIdx) => (
                      <div key={optIdx} className="text-xs">
                        {isEditing ? (
                          <div className="flex items-start gap-2">
                            <textarea 
                              className="flex-grow border p-1 rounded bg-white" 
                              rows={1}
                              value={opt} 
                              onChange={(e)=>{
                                const newSections = [...examData.sections];
                                newSections[sIdx].questions[qIdx].sub_questions[subIdx].options[optIdx] = e.target.value;
                                setExamData({ ...examData, sections: newSections });
                              }}
                            />
                            <button 
                              onClick={()=>{
                                const newSections = [...examData.sections];
                                newSections[sIdx].questions[qIdx].sub_questions[subIdx].options.splice(optIdx, 1);
                                setExamData({ ...examData, sections: newSections });
                              }}
                              className="no-print text-red-600 hover:text-red-800"
                            >
                              <X size={12}/>
                            </button>
                          </div>
                        ) : (
                          <RenderText text={opt}/>
                        )}
                      </div>
                    ))}
                    {isEditing && (
                      <button 
                        onClick={()=>{
                          const newSections = [...examData.sections];
                          if (!newSections[sIdx].questions[qIdx].sub_questions[subIdx].options) {
                            newSections[sIdx].questions[qIdx].sub_questions[subIdx].options = [];
                          }
                          newSections[sIdx].questions[qIdx].sub_questions[subIdx].options.push("New option");
                          setExamData({ ...examData, sections: newSections });
                        }}
                        className="no-print mt-1 inline-flex items-center gap-1 text-xs font-bold text-teal-600 cursor-pointer bg-teal-50 px-2 py-1 rounded border border-teal-200 hover:bg-teal-100"
                      >
                        <Plus size={12}/> Add Option
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  if (view === 'input') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-xl shadow-lg text-center max-w-lg w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 font-serif italic">Exam Paper Builder</h1>
          <label className={`flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 rounded-xl p-12 cursor-pointer hover:bg-blue-100 transition ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
             <UploadCloud size={48} className="text-blue-500 mb-4"/>
             <span className="font-bold text-blue-700 text-lg">{isLoading ? "Processing PDF..." : "Upload Question Paper (PDF)"}</span>
             <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={isLoading} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-900 print:bg-white print:p-0" style={{fontFamily: 'Calibri, sans-serif'}}>
      <PrintStyles />
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex justify-between bg-white p-3 rounded shadow sticky top-0 z-50">
        <button onClick={() => setView('input')} className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-800">
          <RefreshCcw size={16}/> New
        </button>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 bg-blue-100 text-blue-800 rounded text-sm font-bold flex gap-2 items-center hover:bg-blue-200">
            {isEditing ? <Check size={16}/> : <Edit2 size={16}/>} {isEditing ? "Finish Editing" : "Edit Paper"}
          </button>
          <button onClick={handleDownloadWord} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold flex gap-2 items-center hover:bg-blue-700">
            <FileDown size={16}/> Download .doc
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded text-sm font-bold flex gap-2 items-center hover:bg-gray-800">
            <Printer size={16}/> Print
          </button>
        </div>
      </div>

      <div ref={componentRef} className="paper-canvas">
        <div className="mb-4 border-2 border-black p-4 text-center">
            <h1 className="text-3xl font-bold uppercase mb-1">
              {isEditing ? (
                <input className="w-full text-center outline-none bg-transparent" value={examData.header.school} onChange={(e)=>updateHeader('school', e.target.value)}/>
              ) : examData.header.school}
            </h1>
            <h2 className="text-xl font-bold uppercase mb-3">
              {isEditing ? (
                <input className="w-full text-center outline-none bg-transparent" value={examData.header.examName} onChange={(e)=>updateHeader('examName', e.target.value)}/>
              ) : examData.header.examName}
            </h2>
            <div className="flex justify-between font-bold border-t-2 border-black pt-2">
                <span>Time: {isEditing ? <input className="w-20 text-center outline-none bg-transparent border-b" value={examData.header.time} onChange={(e)=>updateHeader('time', e.target.value)}/> : examData.header.time}</span>
                <span>Max Marks: {isEditing ? <input className="w-16 text-center outline-none bg-transparent border-b" value={examData.header.marks} onChange={(e)=>updateHeader('marks', e.target.value)}/> : examData.header.marks}</span>
            </div>
        </div>

        {/* Instructions Block - Only on first page */}
        {examData.header.instructions && (
          <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded">
            <h3 className="font-bold text-center mb-2 uppercase">General Instructions</h3>
            {isEditing ? (
              <div className="relative">
                <textarea 
                  className="w-full border p-3 rounded bg-white text-sm" 
                  rows={5} 
                  value={examData.header.instructions} 
                  onChange={(e)=>updateHeader('instructions', e.target.value)}
                  placeholder="Enter general instructions for the exam..."
                />
                <button 
                  onClick={() => updateHeader('instructions', '')}
                  className="no-print absolute top-2 right-2 text-red-600 hover:text-red-800 bg-white rounded-full p-1"
                >
                  <X size={14}/>
                </button>
              </div>
            ) : (
              <div className="text-sm whitespace-pre-wrap">
                <RenderText text={examData.header.instructions} />
              </div>
            )}
          </div>
        )}

        {/* Add Instructions Button */}
        {isEditing && !examData.header.instructions && (
          <div className="no-print mb-4 text-center">
            <button 
              onClick={() => updateHeader('instructions', '1. Read all questions carefully.\n2. Write your answers in the provided space.\n3. All questions are compulsory.')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded text-sm font-bold hover:bg-blue-600"
            >
              <Plus size={16}/> Add General Instructions
            </button>
          </div>
        )}

        <table className="w-full border-collapse border-2 border-black">
           <thead>
             <tr className="bg-gray-100 border-b-2 border-black">
               <th className="border-r-2 border-black p-2 w-[45px] text-center">Q.No</th>
               <th className="border-r-2 border-black p-2 text-left">Questions</th>
               <th className="p-2 w-[55px] text-center">Marks</th>
             </tr>
           </thead>
           <tbody>
             {examData.sections.map((section, sIdx) => (
               <React.Fragment key={sIdx}>
                 <tr className="bg-gray-50 border-b-2 border-black">
                   <td colSpan="3" className="p-2 font-bold text-center uppercase bg-gray-100 relative">
                     {isEditing ? (
                       <div className="flex items-center justify-center gap-2">
                         <input 
                           className="text-center outline-none bg-transparent flex-grow" 
                           value={section.title} 
                           onChange={(e)=>updateSectionTitle(sIdx, e.target.value)}
                         />
                         <button onClick={() => deleteSection(sIdx)} className="no-print text-red-600 hover:text-red-800">
                           <X size={16}/>
                         </button>
                       </div>
                     ) : section.title}
                   </td>
                 </tr>
                 {section.questions.map((q, qIdx) => (
                   <tr key={qIdx} className="border-b-2 border-black last:border-b-0">
                     <td className="border-r-2 border-black p-2 text-center align-top font-bold">
                       {isEditing ? (
                         <input 
                           className="w-full text-center outline-none bg-transparent" 
                           value={q.number} 
                           onChange={(e)=>updateQuestion(sIdx, qIdx, 'number', e.target.value)}
                         />
                       ) : q.number}
                     </td>
                     <td className="border-r-2 border-black p-3 align-top">
                        {/* Render question elements in custom order */}
                        {(q.order || ['context', 'text', 'image', 'options', 'sub_questions']).map(elementType => 
                          renderQuestionElement(elementType, sIdx, qIdx, q)
                        )}
                        
                        {/* Add Context Button */}
                        {isEditing && !q.context && (
                          <button 
                            onClick={() => addContext(sIdx, qIdx)}
                            className="no-print mb-3 inline-flex items-center gap-1 text-xs font-bold text-purple-600 cursor-pointer bg-purple-50 px-2 py-1 rounded border border-purple-200 hover:bg-purple-100"
                          >
                            <Plus size={14}/> Add Context/Passage
                          </button>
                        )}

                        {/* Add Image Button */}
                        {isEditing && !q.image && (
                          <label className="no-print inline-flex items-center gap-1 text-xs font-bold text-blue-600 cursor-pointer mb-3 ml-2 bg-blue-50 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100">
                             <Image size={14}/> Add Diagram
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(sIdx, qIdx, e)} />
                          </label>
                        )}

                        {/* Add Sub Question Button */}
                        {isEditing && (
                          <button 
                            onClick={() => addSubQuestion(sIdx, qIdx)}
                            className="no-print mt-2 inline-flex items-center gap-1 text-xs font-bold text-green-600 cursor-pointer bg-green-50 px-2 py-1 rounded border border-green-200 hover:bg-green-100"
                          >
                            <Plus size={14}/> Add Sub-Question
                          </button>
                        )}

                        {/* Add Option Button */}
                        {isEditing && (
                          <button 
                            onClick={() => addOption(sIdx, qIdx)}
                            className="no-print mt-2 ml-2 inline-flex items-center gap-1 text-xs font-bold text-orange-600 cursor-pointer bg-orange-50 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100"
                          >
                            <Plus size={14}/> Add Option/Choice
                          </button>
                        )}
                     </td>
                     <td className="p-2 text-center align-top font-bold">
                       {isEditing ? (
                         <input 
                           className="w-full text-center outline-none bg-transparent border-b" 
                           value={q.marks} 
                           onChange={(e)=>updateQuestion(sIdx, qIdx, 'marks', e.target.value)}
                         />
                       ) : q.marks}
                     </td>
                   </tr>
                 ))}
                 {isEditing && (
                   <tr className="no-print">
                     <td colSpan="3" className="p-2 text-center space-x-2">
                       <button 
                         onClick={() => addQuestion(sIdx)}
                         className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded text-sm font-bold hover:bg-blue-600"
                       >
                         <Plus size={16}/> Add Question
                       </button>
                       <button 
                         onClick={() => addOrQuestion(sIdx)}
                         className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded text-sm font-bold hover:bg-purple-600"
                       >
                         <Plus size={16}/> Add OR Question
                       </button>
                     </td>
                   </tr>
                 )}
               </React.Fragment>
             ))}
           </tbody>
        </table>
        
        {isEditing && (
          <div className="no-print mt-4 text-center">
            <button 
              onClick={addSection}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700"
            >
              <Plus size={18}/> Add New Section
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;