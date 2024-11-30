'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { startCall, endCall } from '@/lib/callFunctions'
import { CallConfig, SelectedTool } from '@/lib/types'
import demoConfig from '@/app/demo-config';
import { Role, Transcript, UltravoxExperimentalMessageEvent, UltravoxSessionStatus } from 'ultravox-client';
import BorderedImage from '@/components/BorderedImage';
import UVLogo from '@/public/UVMark-White.svg';
import CallStatus from '@/components/CallStatus';
import DebugMessages from '@/components/DebugMessages';
import MicToggleButton from '@/components/MicToggleButton';
import { PhoneOffIcon } from 'lucide-react';

type SearchParamsProps = {
  showMuteSpeakerButton: boolean;
  modelOverride: string | undefined;
  showDebugMessages: boolean;
  showUserTranscripts: boolean;
};

type SearchParamsHandlerProps = {
  children: (props: SearchParamsProps) => React.ReactNode;
};

function SearchParamsHandler({ children }: SearchParamsHandlerProps) {
  // Process query params to see if we want to change the behavior for showing speaker mute button or changing the model
  const searchParams = useSearchParams();
  const showMuteSpeakerButton = searchParams.get('showSpeakerMute') === 'true';
  const showDebugMessages = searchParams.get('showDebugMessages') === 'true';
  const showUserTranscripts = searchParams.get('showUserTranscripts') === 'true';
  let modelOverride: string | undefined;

  if (searchParams.get('model')) {
    modelOverride = "fixie-ai/" + searchParams.get('model');
  }

  return children({ showMuteSpeakerButton, modelOverride, showDebugMessages, showUserTranscripts });
}

export default function Home() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('off');
  const [callTranscript, setCallTranscript] = useState<Transcript[] | null>([]);
  const [callDebugMessages, setCallDebugMessages] = useState<UltravoxExperimentalMessageEvent[]>([]);
  const [customerProfileKey, setCustomerProfileKey] = useState<string | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [callTranscript]);

  const handleStatusChange = useCallback((status: UltravoxSessionStatus | string | undefined) => {
    if (status) {
      setAgentStatus(status);
    } else {
      setAgentStatus('off');
    }

  }, []);

  const handleTranscriptChange = useCallback((transcripts: Transcript[] | undefined) => {
    if (transcripts) {
      setCallTranscript([...transcripts]);
    }
  }, []);

  const handleDebugMessage = useCallback((debugMessage: UltravoxExperimentalMessageEvent) => {
    setCallDebugMessages(prevMessages => [...prevMessages, debugMessage]);
  }, []);

  const clearCustomerProfile = useCallback(() => {
    // This will trigger a re-render of CustomerProfileForm with a new empty profile
    setCustomerProfileKey(prev => prev ? `${prev}-cleared` : 'cleared');
  }, []);

  const handleStartCallButtonClick = async (modelOverride?: string, showDebugMessages?: boolean) => {
    try {
      handleStatusChange('Starting call...');
      setCallTranscript(null);
      setCallDebugMessages([]);
      clearCustomerProfile();

      // Generate a new key for the customer profile
      const newKey = `call-${Date.now()}`;
      setCustomerProfileKey(newKey);

      // Setup our call config including the call key as a parameter restriction
      let callConfig: CallConfig = {
        systemPrompt: demoConfig.callConfig.systemPrompt,
        model: modelOverride || demoConfig.callConfig.model,
        languageHint: demoConfig.callConfig.languageHint,
        voice: demoConfig.callConfig.voice,
        temperature: demoConfig.callConfig.temperature,
        maxDuration: demoConfig.callConfig.maxDuration,
        timeExceededMessage: demoConfig.callConfig.timeExceededMessage
      };

      const paramOverride: { [key: string]: any } = {
        "callId": newKey
      }

      let cpTool: SelectedTool | undefined = demoConfig?.callConfig?.selectedTools?.find(tool => tool.toolName === "createProfile");

      if (cpTool) {
        cpTool.parameterOverrides = paramOverride;
      }
      callConfig.selectedTools = demoConfig.callConfig.selectedTools;

      await startCall({
        onStatusChange: handleStatusChange,
        onTranscriptChange: handleTranscriptChange,
        onDebugMessage: handleDebugMessage
      }, callConfig, showDebugMessages);

      setIsCallActive(true);
      handleStatusChange('Call started successfully');
    } catch (error) {
      handleStatusChange(`Error starting call: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleEndCallButtonClick = async () => {
    try {
      handleStatusChange('Ending call...');
      await endCall();
      setIsCallActive(false);

      clearCustomerProfile();
      setCustomerProfileKey(null);
      handleStatusChange('Call ended successfully');
    } catch (error) {
      handleStatusChange(`Error ending call: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchParamsHandler>
        {({ showMuteSpeakerButton, modelOverride, showDebugMessages, showUserTranscripts }: SearchParamsProps) => (
          <div className="flex flex-col items-center justify-center">
            {/* Main Area */}
            <div className="max-w-[1206px] mx-auto w-full rounded-[3px] h-full">
              <div className="flex flex-col justify-center lg:flex-row ">
                {/* Action Area */}
                <div className="w-full lg:w-2/3 bg-customBrown-100 h-[calc(90vh)] rounded-lg">
                  
                  <div className="flex flex-col justify-between items-start h-full font-mono p-4 ">
                    {/* <div className="mt-20 self-center">
                      <BorderedImage
                        src={UVLogo}
                        alt="todo"
                        size="md"
                      />
                    </div> */}
                    {isCallActive ? (
                      <div className="w-full">
                        <div className="mb-5 relative">
                          <div
                            ref={transcriptContainerRef}
                            className="h-[calc(100vh-250px)] p-2.5 overflow-y-auto relative space-y-4"
                          >
                            {callTranscript && callTranscript.map((transcript, index) => (
                              <div
                                key={index}
                                
                                className={`flex ${transcript.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}
                              >
                                <div
                                  className={`max-w-[70%] p-3 rounded-lg ${transcript.speaker === 'agent' ? 'bg-customBrown-300 text-gray-900' : 'bg-customBrown-400 text-white'
                                    } shadow-sm`}
                                >
                                  <p className="text-sm font-bold mb-1">
                                    {transcript.speaker === 'agent' ? "AIAgent" : "User"}
                                  </p>
                                  <p className="text-base">{transcript.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="absolute inset-x-0 top-0 h-20 pointer-events-none" />
                        </div>
                        <div className="flex justify-between space-x-4 p-4 w-full">
                          <MicToggleButton role={Role.USER} />
                          {showMuteSpeakerButton && <MicToggleButton role={Role.AGENT} />}
                          <button
                            type="button"
                            className="flex-grow flex items-center justify-center h-10 bg-red-500"
                            onClick={handleEndCallButtonClick}
                            disabled={!isCallActive}
                          >
                            <PhoneOffIcon width={24} className="brightness-0 invert" />
                            <span className="ml-2">End Call</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="h-[300px] text-gray-400 mb-6 mt-32 lg:mt-0">
                          {demoConfig.overview}
                        </div>
                        <button
                          type="button"
                          className="hover:bg-customBrown-700 px-6 py-2 border-2 w-full mb-4 bg-customBrown-500"
                          onClick={() => handleStartCallButtonClick(modelOverride, showDebugMessages)}
                        >
                          Start Call
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SearchParamsHandler>
    </Suspense>
  )
}