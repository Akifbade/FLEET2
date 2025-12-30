import React from 'react';
import { Shield, Server, Database, Zap } from 'lucide-react';

const BackendStatus: React.FC<{ useParseServer: boolean }> = ({ useParseServer }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-gray-200 z-50">
      <div className="flex items-center gap-2">
        {useParseServer ? (
          <>
            <Server className="w-4 h-4 text-blue-600" />
            <div className="text-[10px] font-bold">
              <p className="text-gray-900">Parse Server</p>
              <p className="text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                VPS Active
              </p>
            </div>
          </>
        ) : (
          <>
            <Database className="w-4 h-4 text-orange-600" />
            <div className="text-[10px] font-bold">
              <p className="text-gray-900">Firebase</p>
              <p className="text-orange-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                Cloud Active
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BackendStatus;
