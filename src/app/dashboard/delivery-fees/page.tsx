"use client";
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeliveryFees, DeliveryFee } from '@/hooks/use-delivery-fees';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit2, Save, X, Trash2, AlertTriangle } from 'lucide-react';

export default function DeliveryFeesPage() {
  const { 
    deliveryFees, 
    loading, 
    updateDeliveryFee, 
    addNewDistrict,
    deleteDistrict,
    removeDuplicateDistricts
  } = useDeliveryFees();
  
  // 지역별 배송비 편집 상태
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // 새로운 지역 추가 상태
  const [newDistrict, setNewDistrict] = useState('');
  const [newFee, setNewFee] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // 중복 데이터 감지
  const duplicateDistricts = deliveryFees.reduce((acc, fee) => {
    const existing = acc.find(f => f.district === fee.district);
    if (existing) {
      existing.count++;
      existing.items.push(fee);
    } else {
      acc.push({ district: fee.district, count: 1, items: [fee] });
    }
    return acc;
  }, [] as Array<{ district: string; count: number; items: DeliveryFee[] }>).filter(item => item.count > 1);

  const hasDuplicates = duplicateDistricts.length > 0;

  // 배송비 편집 시작
  const handleEditStart = (id: string, currentFee: number) => {
    setEditingFee(id);
    setEditValue(currentFee.toString());
  };

  // 배송비 편집 저장
  const handleEditSave = async (id: string) => {
    const fee = parseInt(editValue);
    if (isNaN(fee) || fee < 0) {
      alert('올바른 배송비를 입력해주세요.');
      return;
    }
    
    await updateDeliveryFee(id, { fee });
    setEditingFee(null);
    setEditValue('');
  };

  // 배송비 편집 취소
  const handleEditCancel = () => {
    setEditingFee(null);
    setEditValue('');
  };

  // 새로운 지역 추가
  const handleAddNewDistrict = async () => {
    if (!newDistrict.trim() || !newFee.trim()) {
      alert('지역명과 배송비를 모두 입력해주세요.');
      return;
    }
    
    const fee = parseInt(newFee);
    if (isNaN(fee) || fee < 0) {
      alert('올바른 배송비를 입력해주세요.');
      return;
    }

    await addNewDistrict(newDistrict.trim(), fee);
    setNewDistrict('');
    setNewFee('');
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">배송비 정보를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="배송비 관리"
        description="지역별 배송비를 설정할 수 있습니다. 설정한 배송비는 배송 주문에 적용됩니다."
      >
        {hasDuplicates && (
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={removeDuplicateDistricts}
              className="flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              중복 제거 ({duplicateDistricts.length}개)
            </Button>
          </div>
        )}
      </PageHeader>

      {/* 지역별 배송비 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            지역별 배송비
                         <Button 
               size="sm" 
               onClick={() => setShowAddForm(!showAddForm)}
               className="bg-blue-600 hover:bg-blue-700 text-white"
             >
               <Plus className="h-4 w-4 mr-2" />
               새 지역 추가
             </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 새로운 지역 추가 폼 */}
          {showAddForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-3">새 지역 추가</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="new-district">지역명</Label>
                  <Input
                    id="new-district"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    placeholder="예: 강남구"
                  />
                </div>
                <div>
                  <Label htmlFor="new-fee">배송비</Label>
                  <Input
                    id="new-fee"
                    type="number"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    placeholder="예: 15000"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleAddNewDistrict} className="flex-1">
                    추가
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddForm(false);
                      setNewDistrict('');
                      setNewFee('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 지역별 배송비 테이블 */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>지역명</TableHead>
                  <TableHead>배송비</TableHead>
                  <TableHead className="text-center">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryFees
                  .sort((a, b) => a.district.localeCompare(b.district, 'ko'))
                  .map((fee) => {
                    const isDuplicate = duplicateDistricts.some(dup => 
                      dup.district === fee.district && dup.count > 1
                    );
                    return (
                      <TableRow key={fee.id} className={isDuplicate ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {fee.district}
                            {isDuplicate && (
                              <Badge variant="destructive" className="text-xs">
                                중복
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingFee === fee.id ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                                                             onKeyDown={(e) => {
                                 if (e.key === 'Enter') {
                                   handleEditSave(fee.id || '');
                                 } else if (e.key === 'Escape') {
                                   setEditingFee(null);
                                   setEditValue('');
                                 }
                               }}
                              autoFocus
                              className="w-20"
                            />
                          ) : (
                            <span>₩{fee.fee.toLocaleString()}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {editingFee === fee.id ? (
                            <div className="flex gap-1 justify-center">
                                                             <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => handleEditSave(fee.id || '')}
                               >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingFee(null);
                                  setEditValue('');
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-center">
                                                             <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => {
                                   setEditingFee(fee.id || '');
                                   setEditValue(fee.fee.toString());
                                 }}
                               >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                                                             <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={() => deleteDistrict(fee.id || '', fee.district)}
                                 className="text-red-600 hover:text-red-700 hover:bg-red-50"
                               >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {/* 통계 정보 */}
          {deliveryFees.length > 0 && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">총 지역 수:</span>
                  <span className="ml-2 font-medium">{deliveryFees.length}개</span>
                </div>
                <div>
                  <span className="text-muted-foreground">평균 배송비:</span>
                  <span className="ml-2 font-medium">
                    ₩{Math.round(deliveryFees.reduce((sum, fee) => sum + fee.fee, 0) / deliveryFees.length).toLocaleString()}
                  </span>
                </div>
                {hasDuplicates && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">중복 데이터:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {duplicateDistricts.length}개 지역 ({duplicateDistricts.reduce((sum, dup) => sum + dup.count, 0)}개 항목)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
