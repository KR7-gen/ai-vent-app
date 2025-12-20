'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AgreementState } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';

function AgreementPage() {
  const [agreements, setAgreements] = useState<AgreementState>({
    secrecy: false,
    ethics: false,
    notAdvice: false,
    noRecording: false,
    ageConfirm: false,
    allAgree: false
  });

  const router = useRouter();

  const handleAgreementChange = (key: keyof AgreementState) => {
    setAgreements(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const canProceed = Object.values(agreements).every(Boolean);

  const handleStart = () => {
    if (canProceed) {
      router.push('/stream');
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center mb-8">
            <button
              onClick={() => router.push('/warning')}
              className="text-gray-600 hover:text-gray-900 transition mr-4"
            >
              ← 戻る
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">利用規約への同意</h1>
              <p className="text-gray-600">以下の項目をすべて確認し、同意してください</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">利用規約</h3>
              
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.secrecy}
                    onChange={() => handleAgreementChange('secrecy')}
                    className="mt-1 w-5 h-5 text-gray-900 rounded focus:ring-gray-500"
                  />
                  <span className="text-gray-600">
                    <strong className="text-gray-900">秘密保持</strong><br />
                    このサービスで聞いた内容を口外しません
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.ethics}
                    onChange={() => handleAgreementChange('ethics')}
                    className="mt-1 w-5 h-5 text-gray-900 rounded focus:ring-gray-500"
                  />
                  <span className="text-gray-600">
                    <strong className="text-gray-900">公序良俗の遵守</strong><br />
                    差別・中傷・脅迫等は行いません
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.notAdvice}
                    onChange={() => handleAgreementChange('notAdvice')}
                    className="mt-1 w-5 h-5 text-gray-900 rounded focus:ring-gray-500"
                  />
                  <span className="text-gray-600">
                    <strong className="text-gray-900">専門助言ではない</strong><br />
                    これは医療・法律等の専門助言ではないことを理解しています
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.noRecording}
                    onChange={() => handleAgreementChange('noRecording')}
                    className="mt-1 w-5 h-5 text-gray-900 rounded focus:ring-gray-500"
                  />
                  <span className="text-gray-600">
                    <strong className="text-gray-900">録音・録画禁止</strong><br />
                    録音・録画・再配布は禁止であることを理解しています
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreements.ageConfirm}
                    onChange={() => handleAgreementChange('ageConfirm')}
                    className="mt-1 w-5 h-5 text-gray-900 rounded focus:ring-gray-500"
                  />
                  <span className="text-gray-600">
                    <strong className="text-gray-900">年齢確認</strong><br />
                    18歳未満は利用できないことを確認しています
                  </span>
                </label>
              </div>
            </div>

            <div className="border-2 border-gray-900 rounded-lg p-4 bg-gray-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreements.allAgree}
                  onChange={() => handleAgreementChange('allAgree')}
                  className="mt-1 w-5 h-5 text-gray-900 rounded focus:ring-gray-500"
                />
                <span className="text-gray-700">
                  <strong className="text-gray-900">上記すべてに同意します</strong><br />
                  <span className="text-sm">※この項目にチェックしないと開始できません</span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={handleStart}
              disabled={!canProceed}
              className={`w-full font-medium py-3 px-4 rounded-lg transition duration-200 ${
                canProceed
                  ? 'bg-gray-900 hover:bg-gray-800 text-white'
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
            >
              {canProceed ? '配信を開始' : '全ての項目に同意してください'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              ※配信開始後はいつでも終了できます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgreementPageWrapper() {
  return (
    <ProtectedRoute>
      <AgreementPage />
    </ProtectedRoute>
  );
}