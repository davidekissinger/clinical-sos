import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/brand/Logo";
import { Clock, ArrowRight } from "lucide-react";

export default function AccessPending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
      <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl border border-border shadow-sm p-8 text-center">
        <div className="flex justify-center mb-6"><Logo /></div>
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center mb-4">
          <Clock className="h-6 w-6 text-amber-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Access Pending</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Your account has been created, but access to private Clinical SOS services requires authorization.
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Client portal access is provided by invitation. If you believe you should have access, please contact Clinical SOS.
        </p>
        <div className="mt-6 space-y-2">
          <Link to="/" className="btn-primary w-full text-sm inline-flex items-center justify-center gap-2">
            Return to Public Site <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}