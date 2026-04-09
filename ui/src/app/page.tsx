"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Tabs, type TabId } from "@/components/Tabs";
import { ToastProvider } from "@/components/Toast";
import { PipelineTab } from "@/components/tabs/PipelineTab";
import { PerformanceTab } from "@/components/tabs/PerformanceTab";
import { SkillsTab } from "@/components/tabs/SkillsTab";
import { LearningsTab } from "@/components/tabs/LearningsTab";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("pipeline");

  return (
    <ToastProvider>
      <div
        className="flex min-h-screen flex-col"
        style={{ background: "#0c0c14", color: "#c8c8d8" }}
      >
        <Header />
        <Tabs active={activeTab} onChange={setActiveTab} />
        <div className="px-8 py-6">
          {activeTab === "pipeline" && <PipelineTab />}
          {activeTab === "performance" && <PerformanceTab />}
          {activeTab === "skills" && <SkillsTab />}
          {activeTab === "learnings" && <LearningsTab />}
        </div>
      </div>
    </ToastProvider>
  );
}
