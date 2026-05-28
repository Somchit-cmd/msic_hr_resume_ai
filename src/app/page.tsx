"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  Loader2,
  FileUp,
  Briefcase,
  User,
  Star,
  ChevronDown,
  ChevronUp,
  Shield,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

// Types
interface CandidateListItem {
  id: string;
  fileName: string;
  scoring: number;
  recommendation: string;
  candidateOverview: string;
  status: string;
  createdAt: string;
}

interface ProfessionalAudit {
  pros: string[];
  cons: string[];
  red_flags: string[];
}

interface CandidateDetail extends CandidateListItem {
  jobDescription: string;
  assessment: string;
  professionalAudit: ProfessionalAudit;
  extractedText?: string;
}

export default function Dashboard() {
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"scoring" | "createdAt">(
    "createdAt"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch candidates on mount
  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/candidates");
      const data = await res.json();
      if (data.candidates) {
        setCandidates(data.candidates);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load candidates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const validFiles = droppedFiles.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        return ext && ["pdf", "docx", "doc"].includes(ext);
      });
      if (validFiles.length === 0) {
        toast({
          title: "Invalid File",
          description: "Please upload PDF, DOCX, or DOC files only.",
          variant: "destructive",
        });
        return;
      }
      setFiles((prev) => [...prev, ...validFiles]);
    },
    [toast]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload handler
  const handleUpload = async () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Missing Job Description",
        description: "Please enter a job description before uploading resumes.",
        variant: "destructive",
      });
      return;
    }
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one resume file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    let errorCount = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("jobDescription", jobDescription);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok && data.success) {
          successCount++;
        } else {
          errorCount++;
          toast({
            title: `Error processing ${file.name}`,
            description: data.error || "Failed to process resume",
            variant: "destructive",
          });
        }
      } catch {
        errorCount++;
        toast({
          title: `Error processing ${file.name}`,
          description: "Network error occurred",
          variant: "destructive",
        });
      }

      setUploadProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsUploading(false);
    setFiles([]);
    setUploadProgress(0);

    if (successCount > 0) {
      toast({
        title: "Processing Complete",
        description: `Successfully analyzed ${successCount} of ${total} resume(s)${errorCount > 0 ? `. ${errorCount} failed.` : "."}`,
      });
      fetchCandidates();
    }
  };

  // View candidate details
  const handleViewCandidate = async (id: string) => {
    setIsDetailOpen(true);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/candidates/${id}`);
      const data = await res.json();
      if (data.candidate) {
        setSelectedCandidate(data.candidate);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load candidate details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Delete candidate
  const handleDeleteCandidate = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/candidates/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({
          title: "Deleted",
          description: "Candidate record has been removed.",
        });
        setCandidates((prev) => prev.filter((c) => c.id !== deleteId));
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete candidate",
        variant: "destructive",
      });
    }
    setDeleteId(null);
  };

  // Sort handler
  const handleSort = (field: "scoring" | "createdAt") => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedCandidates = [...candidates].sort((a, b) => {
    const modifier = sortDir === "asc" ? 1 : -1;
    if (sortField === "scoring") {
      return (a.scoring - b.scoring) * modifier;
    }
    return (
      (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
      modifier
    );
  });

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-600";
    if (score >= 6) return "text-amber-600";
    if (score >= 4) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return "bg-emerald-50 border-emerald-200";
    if (score >= 6) return "bg-amber-50 border-amber-200";
    if (score >= 4) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  };

  const getRecommendationVariant = (
    rec: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const lower = rec.toLowerCase();
    if (lower.includes("strong hire")) return "default";
    if (lower.includes("hire") && !lower.includes("no")) return "secondary";
    if (lower.includes("no hire")) return "destructive";
    return "outline";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  ResumeScreen AI
                </h1>
                <p className="text-xs text-gray-500">
                  Intelligent Resume Screening for HR Professionals
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCandidates()}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Job Description Input */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                Job Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste the job description here. Include role title, required qualifications, experience level, key skills, and responsibilities..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-[240px] resize-y text-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                {jobDescription.length} characters • Minimum 20 characters
                required
              </p>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileUp className="h-4 w-4 text-emerald-600" />
                Upload Resumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-50/50 scale-[1.01]"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload
                  className={`h-10 w-10 mx-auto mb-3 ${
                    isDragging ? "text-emerald-500" : "text-gray-400"
                  }`}
                />
                <p className="text-sm font-medium text-gray-700">
                  {isDragging
                    ? "Drop files here"
                    : "Drag & drop resumes here"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  or click to browse • PDF, DOCX, DOC • Max 10MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-700 truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <XCircle className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Processing resumes...</span>
                    <span className="text-gray-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Upload Button */}
              <Button
                className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Resumes...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Screen {files.length > 0 ? `${files.length} Resume(s)` : "Resumes"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stats Bar */}
        {candidates.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 font-medium">
                  Total Screened
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {candidates.length}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 font-medium">
                  Avg. Score
                </p>
                <p className="text-2xl font-bold text-emerald-600">
                  {candidates.length > 0
                    ? (
                        candidates.reduce((sum, c) => sum + c.scoring, 0) /
                        candidates.length
                      ).toFixed(1)
                    : "0"}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 font-medium">Hires</p>
                <p className="text-2xl font-bold text-teal-600">
                  {
                    candidates.filter(
                      (c) =>
                        c.recommendation.toLowerCase().includes("hire") &&
                        !c.recommendation.toLowerCase().includes("no")
                    ).length
                  }
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 font-medium">No Hires</p>
                <p className="text-2xl font-bold text-red-600">
                  {
                    candidates.filter((c) =>
                      c.recommendation.toLowerCase().includes("no hire")
                    ).length
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Candidates Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600" />
              Screened Candidates
              {candidates.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {candidates.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">
                  Loading candidates...
                </span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">
                  No candidates screened yet
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Upload resumes above to start screening
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("scoring")}
                      >
                        <span className="flex items-center gap-1">
                          Score
                          {sortField === "scoring" ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <Star className="h-3.5 w-3.5 text-gray-300" />
                          )}
                        </span>
                      </TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("createdAt")}
                      >
                        <span className="flex items-center gap-1">
                          Date
                          {sortField === "createdAt" ? (
                            sortDir === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <TrendingUp className="h-3.5 w-3.5 text-gray-300" />
                          )}
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCandidates.map((candidate, index) => (
                      <TableRow key={candidate.id} className="group">
                        <TableCell className="text-gray-400 text-sm">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {candidate.fileName}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-[280px]">
                              {candidate.candidateOverview}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className={`inline-flex items-center justify-center h-9 w-9 rounded-lg border font-bold text-sm ${getScoreBg(candidate.scoring)} ${getScoreColor(candidate.scoring)}`}
                          >
                            {candidate.scoring}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getRecommendationVariant(
                              candidate.recommendation
                            )}
                          >
                            {candidate.recommendation}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(candidate.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() =>
                                handleViewCandidate(candidate.id)
                              }
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-500 hover:text-red-700"
                              onClick={() => setDeleteId(candidate.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-gray-400 text-center">
            ResumeScreen AI — Powered by AI-driven analysis. All data is
            processed securely and stored locally.
          </p>
        </div>
      </footer>

      {/* Candidate Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Candidate Audit Report
            </DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading details...</span>
            </div>
          ) : selectedCandidate ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">
                      {selectedCandidate.fileName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Screened on{" "}
                      {new Date(
                        selectedCandidate.createdAt
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${getScoreBg(selectedCandidate.scoring)}`}
                  >
                    <span
                      className={`text-3xl font-bold ${getScoreColor(selectedCandidate.scoring)}`}
                    >
                      {selectedCandidate.scoring}
                    </span>
                    <span className="text-xs text-gray-500">
                      /10
                    </span>
                  </div>
                </div>

                {/* Recommendation Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">
                    Recommendation:
                  </span>
                  <Badge
                    variant={getRecommendationVariant(
                      selectedCandidate.recommendation
                    )}
                    className="text-sm px-3 py-1"
                  >
                    {selectedCandidate.recommendation}
                  </Badge>
                </div>

                <Separator />

                {/* Candidate Overview */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    Candidate Overview
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg">
                    {selectedCandidate.candidateOverview}
                  </p>
                </div>

                {/* Assessment */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    Detailed Assessment
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg">
                    {selectedCandidate.assessment}
                  </p>
                </div>

                {/* Professional Audit */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 mb-3">
                    Professional Audit
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Pros */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h5 className="font-semibold text-sm text-emerald-800 flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Strengths
                      </h5>
                      <ul className="space-y-1.5">
                        {selectedCandidate.professionalAudit.pros.map(
                          (pro, i) => (
                            <li
                              key={i}
                              className="text-sm text-emerald-700 flex items-start gap-1.5"
                            >
                              <span className="text-emerald-500 mt-0.5">•</span>
                              {pro}
                            </li>
                          )
                        )}
                        {selectedCandidate.professionalAudit.pros.length ===
                          0 && (
                          <li className="text-sm text-emerald-600 italic">
                            No strengths identified
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Cons */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h5 className="font-semibold text-sm text-amber-800 flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        Weaknesses
                      </h5>
                      <ul className="space-y-1.5">
                        {selectedCandidate.professionalAudit.cons.map(
                          (con, i) => (
                            <li
                              key={i}
                              className="text-sm text-amber-700 flex items-start gap-1.5"
                            >
                              <span className="text-amber-500 mt-0.5">•</span>
                              {con}
                            </li>
                          )
                        )}
                        {selectedCandidate.professionalAudit.cons.length ===
                          0 && (
                          <li className="text-sm text-amber-600 italic">
                            No weaknesses identified
                          </li>
                        )}
                      </ul>
                    </div>

                    {/* Red Flags */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h5 className="font-semibold text-sm text-red-800 flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        Red Flags
                      </h5>
                      <ul className="space-y-1.5">
                        {selectedCandidate.professionalAudit.red_flags.map(
                          (flag, i) => (
                            <li
                              key={i}
                              className="text-sm text-red-700 flex items-start gap-1.5"
                            >
                              <span className="text-red-500 mt-0.5">•</span>
                              {flag}
                            </li>
                          )
                        )}
                        {selectedCandidate.professionalAudit.red_flags
                          .length === 0 && (
                          <li className="text-sm text-red-600 italic">
                            No red flags identified
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Job Description Used */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-emerald-600" />
                    Job Description Used
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg max-h-32 overflow-y-auto">
                    {selectedCandidate.jobDescription}
                  </p>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate Record</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              candidate record and all associated screening data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCandidate}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
