"use client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Customer, useCustomers } from "@/hooks/use-customers"
import { useOrders } from "@/hooks/use-orders"
import { useState, useEffect } from "react"
import { PointEditDialog } from "./point-edit-dialog"
import { PointHistoryDialog } from "./point-history-dialog"
import { Eye, Package, Calendar, DollarSign, Download, Coins, History } from "lucide-react"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
// 안전한 날짜 포맷팅 함수
const formatSafeDate = (dateValue: any) => {
  try {
    // 문자열인 경우
    if (typeof dateValue === 'string') {
      return format(new Date(dateValue), 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
    }
    // Date 객체인 경우
    if (dateValue instanceof Date) {
      return format(dateValue, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
    }
    return '-';
  } catch (error) {
    // 개발 환경에서만 콘솔에 출력
    if (process.env.NODE_ENV === 'development') {
      console.error('Date formatting error:', error, dateValue);
    }
    return '-';
  }
};
interface CustomerDetailDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  customer: Customer | null
  onCustomerUpdate?: (updatedCustomer: Customer) => void
}
export function CustomerDetailDialog({ isOpen, onOpenChange, customer, onCustomerUpdate }: CustomerDetailDialogProps) {
  const { orders } = useOrders();
  const { updateCustomerPoints } = useCustomers();
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showPointEdit, setShowPointEdit] = useState(false);
  const [showPointHistory, setShowPointHistory] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(customer);

  // 고객 정보 실시간 업데이트
  const fetchCustomerData = async (customerId: string) => {
    try {
      const customerDoc = await getDoc(doc(db, 'customers', customerId));
      if (customerDoc.exists()) {
        const data = customerDoc.data();
        const updatedCustomer = {
          id: customerDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          lastOrderDate: data.lastOrderDate?.toDate ? data.lastOrderDate.toDate().toISOString() : data.lastOrderDate,
        } as Customer;
        setCurrentCustomer(updatedCustomer);
        // 부모 컴포넌트에 업데이트된 고객 정보 전달
        if (onCustomerUpdate) {
          onCustomerUpdate(updatedCustomer);
        }
      }
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching customer data:', error);
      }
    }
  };

  // 포인트 업데이트 핸들러
  const handlePointUpdate = async (customerId: string, newPoints: number, reason: string, modifier: string) => {
    await updateCustomerPoints(customerId, newPoints, reason, modifier);
    // 포인트 수정 후 고객 정보 새로고침
    await fetchCustomerData(customerId);
  };

  // 다이얼로그가 열릴 때 고객 정보 설정
  useEffect(() => {
    if (isOpen && customer) {
      setCurrentCustomer(customer);
    }
  }, [isOpen, customer]);

  // 엑셀 다운로드 함수
  const handleExportOrders = () => {
    if (customerOrders.length === 0) {
      alert('다운로드할 구매 내역이 없습니다.');
      return;
    }
    // 엑셀 데이터 준비 (상세 정보 포함)
    const excelData = customerOrders.map(order => {
      // 상품 목록을 문자열로 변환
      const itemsList = order.items?.map((item: any) => 
        `${item.name} (${item.quantity}개 x ${item.price?.toLocaleString()}원)`
      ).join('; ') || '';
      // 배송 정보
      const deliveryInfo = order.deliveryInfo ? 
        `${order.deliveryInfo.recipientName} / ${order.deliveryInfo.recipientContact} / ${order.deliveryInfo.address}` : 
        '픽업';
      // 픽업 정보
      const pickupInfo = order.pickupInfo ? 
        `${order.pickupInfo.pickerName} / ${order.pickupInfo.pickerContact} / ${order.pickupInfo.date} ${order.pickupInfo.time}` : 
        '';
      return {
        '주문일': formatSafeDate(order.orderDate),
        '주문번호': order.id || '',
        '주문자명': order.orderer?.name || '',
        '주문자연락처': order.orderer?.contact || '',
        '주문자회사': order.orderer?.company || '',
        '주문자이메일': order.orderer?.email || '',
        '지점': order.branchName || '',
        '주문타입': order.orderType || '',
        '수령방법': order.receiptType === 'store_pickup' ? '매장픽업 (즉시)' : 
                   order.receiptType === 'pickup_reservation' ? '픽업예약' : 
                   order.receiptType === 'delivery_reservation' ? '배송예약' : '기타',
        '배송정보': deliveryInfo,
        '픽업정보': pickupInfo,
        '상품목록': itemsList,
        '상품수': order.items?.length || 0,
        '상품금액': order.summary?.subtotal || 0,
        '할인금액': order.summary?.discount || 0,
        '배송비': order.summary?.deliveryFee || 0,
        '사용포인트': order.summary?.pointsUsed || 0,
        '적립포인트': order.summary?.pointsEarned || 0,
        '총금액': order.summary?.total || 0,
        '결제방법': order.payment?.method || '',
        '결제상태': order.payment?.status === 'completed' ? '완결' : '미결',
        '주문상태': order.status === 'completed' ? '완료' : order.status === 'canceled' ? '취소' : '진행중',
        '메시지타입': order.message?.type || '',
        '메시지내용': order.message?.content || '',
        '요청사항': order.request || ''
      };
    });
    // 파일명 생성
    const fileName = `${customer.name}_상세구매내역_${new Date().toISOString().split('T')[0]}`;
    // 엑셀 다운로드
    import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(excelData);
      // 컬럼 너비 자동 조정
      const colWidths = [
        { wch: 15 }, // 주문일
        { wch: 12 }, // 주문번호
        { wch: 10 }, // 주문자명
        { wch: 15 }, // 주문자연락처
        { wch: 15 }, // 주문자회사
        { wch: 20 }, // 주문자이메일
        { wch: 10 }, // 지점
        { wch: 10 }, // 주문타입
        { wch: 8 },  // 수령방법
        { wch: 30 }, // 배송정보
        { wch: 25 }, // 픽업정보
        { wch: 50 }, // 상품목록
        { wch: 8 },  // 상품수
        { wch: 12 }, // 상품금액
        { wch: 12 }, // 할인금액
        { wch: 10 }, // 배송비
        { wch: 12 }, // 사용포인트
        { wch: 12 }, // 적립포인트
        { wch: 12 }, // 총금액
        { wch: 10 }, // 결제방법
        { wch: 8 },  // 결제상태
        { wch: 8 },  // 주문상태
        { wch: 10 }, // 메시지타입
        { wch: 30 }, // 메시지내용
        { wch: 30 }  // 요청사항
      ];
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '상세구매내역');
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    });
  };
  useEffect(() => {
    if (currentCustomer && orders.length > 0) {
      // 이름과 연락처가 모두 일치하는 주문만 필터링 (가장 정확한 매칭)
      const filteredOrders = orders.filter(order => {
        const nameMatch = order.orderer?.name === currentCustomer.name;
        const contactMatch = order.orderer?.contact === currentCustomer.contact;
        // 연락처 형식 정규화 (하이픈 제거) - 안전한 문자열 처리
        const normalizedOrderContact = typeof order.orderer?.contact === 'string' ? order.orderer.contact.replace(/[-]/g, '') : '';
        const normalizedCustomerContact = typeof currentCustomer.contact === 'string' ? currentCustomer.contact.replace(/[-]/g, '') : '';
        const normalizedContactMatch = normalizedOrderContact === normalizedCustomerContact;
        // 이름과 연락처가 모두 일치하는 경우만 매칭
        const exactNameContactMatch = nameMatch && (contactMatch || normalizedContactMatch);
        // 고객 ID가 있는 경우 ID 매칭도 허용
        const idMatch = order.orderer?.id === currentCustomer.id;
        return exactNameContactMatch || idMatch;
      });
      setCustomerOrders(filteredOrders);
    } else {
      setCustomerOrders([]);
    }
  }, [currentCustomer, orders]);
  if (!currentCustomer) return null
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>고객 상세 정보</span>
              <Badge variant="outline">{currentCustomer.companyName || currentCustomer.name}</Badge>
            </DialogTitle>
            <DialogDescription>
              고객의 상세 정보, 포인트 현황, 구매 내역을 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">기본 정보</TabsTrigger>
              <TabsTrigger value="orders">구매 내역 ({customerOrders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">기본 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">고객명</label>
                    <p className="text-sm mt-1">{currentCustomer.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">회사명</label>
                    <p className="text-sm mt-1">{currentCustomer.companyName || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">연락처</label>
                    <p className="text-sm mt-1">{currentCustomer.contact}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">이메일</label>
                    <p className="text-sm mt-1">{currentCustomer.email || '-'}</p>
                  </div>
                </div>
              </div>
              <Separator />
                             {/* 추가 정보 */}
               <div>
                 <h3 className="text-lg font-semibold mb-3">추가 정보</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="text-sm font-medium text-muted-foreground">주 거래 지점</label>
                     <p className="text-sm mt-1">{currentCustomer.primaryBranch || currentCustomer.branch || '-'}</p>
                   </div>
                   <div>
                     <label className="text-sm font-medium text-muted-foreground">고객 등급</label>
                     <p className="text-sm mt-1">{currentCustomer.grade || '신규'}</p>
                   </div>
                 </div>
               </div>
               <Separator />
               {/* 고객 정보 */}
               <div>
                 <h3 className="text-lg font-semibold mb-3">고객 정보</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="text-sm font-medium text-muted-foreground">고객 유형</label>
                     <p className="text-sm mt-1">{currentCustomer.type === 'company' ? '기업' : '개인'}</p>
                   </div>
                   {currentCustomer.companyName && (
                     <div>
                       <label className="text-sm font-medium text-muted-foreground">회사명</label>
                       <p className="text-sm mt-1">{currentCustomer.companyName}</p>
                     </div>
                   )}
                 </div>
               </div>
              <Separator />
                             {/* 포인트 정보 */}
               <div>
                 <div className="flex items-center justify-between mb-3">
                   <h3 className="text-lg font-semibold">포인트 정보</h3>
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setShowPointHistory(true)}
                       className="flex items-center gap-2"
                     >
                       <History className="h-4 w-4" />
                       이력 조회
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setShowPointEdit(true)}
                       className="flex items-center gap-2"
                     >
                       <Coins className="h-4 w-4" />
                       포인트 수정
                     </Button>
                   </div>
                 </div>
                 <div className="flex items-center gap-2">
                   <span className="text-sm font-medium text-muted-foreground">보유 포인트:</span>
                   <Badge variant="secondary" className="text-lg font-bold">
                     {(currentCustomer.points || 0).toLocaleString()} P
                   </Badge>
                 </div>
               </div>
              <Separator />
              {/* 등록 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">등록 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">등록일</label>
                    <p className="text-sm mt-1">
                      {formatSafeDate(currentCustomer.createdAt)}
                    </p>
                  </div>
                  {currentCustomer.lastOrderDate && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">최근 주문일</label>
                      <p className="text-sm mt-1">
                        {formatSafeDate(currentCustomer.lastOrderDate)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="orders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">구매 내역</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>총 {customerOrders.length}건의 주문</span>
                  </div>
                  {customerOrders.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportOrders}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </Button>
                  )}
                </div>
              </div>
              {customerOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>구매 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>주문일</TableHead>
                        <TableHead>주문번호</TableHead>
                        <TableHead>상품명</TableHead>
                        <TableHead>수량</TableHead>
                        <TableHead>총 금액</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>상세보기</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatSafeDate(order.orderDate)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{order.id?.slice(0, 8) || order.orderNumber || '-'}</TableCell>
                          <TableCell>
                            <div className="max-w-[200px]">
                              {order.items && order.items.length > 0 ? (
                                <div className="space-y-1">
                                  {order.items.slice(0, 2).map((item: any, index: number) => (
                                    <div key={index} className="text-sm">
                                      <span className="font-medium">{item.name}</span>
                                      {order.items.length > 2 && index === 1 && (
                                        <span className="text-muted-foreground ml-1">
                                          외 {order.items.length - 2}개
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">상품 정보 없음</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {order.items?.reduce((total: number, item: any) => total + (item.quantity || 0), 0) || 0}개
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              {(order.summary?.total || order.totalAmount || 0).toLocaleString()}원
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              order.status === 'completed' ? 'default' : 
                              order.status === 'canceled' ? 'destructive' : 'secondary'
                            }>
                              {order.status === 'completed' ? '완료' : 
                               order.status === 'canceled' ? '취소' : '진행중'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowOrderDetail(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      {/* 주문 상세 정보 다이얼로그 */}
      {selectedOrder && (
        <Dialog open={showOrderDetail} onOpenChange={setShowOrderDetail}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>주문 상세 정보</span>
                <Badge variant="outline">{selectedOrder.orderNumber}</Badge>
              </DialogTitle>
              <DialogDescription>
                주문의 상세 정보와 상품 목록을 확인할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* 주문 기본 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">주문 정보</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">주문번호</label>
                    <p className="text-sm mt-1">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">주문일</label>
                    <p className="text-sm mt-1">{formatSafeDate(selectedOrder.orderDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">총 금액</label>
                    <p className="text-sm mt-1 font-bold">{selectedOrder.totalAmount?.toLocaleString() || 0}원</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">상태</label>
                    <div className="text-sm mt-1">
                      <Badge variant={selectedOrder.status === 'completed' ? 'default' : 'secondary'}>
                        {selectedOrder.status === 'completed' ? '완료' : '진행중'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
              {/* 상품 목록 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">상품 목록</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrder.items.map((item: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              수량: {item.quantity}개 | 단가: {item.price?.toLocaleString() || 0}원
                            </p>
                          </div>
                          <p className="font-bold">
                            {(item.price * item.quantity)?.toLocaleString() || 0}원
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">상품 정보가 없습니다.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
             )}

       {/* 포인트 수정 다이얼로그 */}
       <PointEditDialog
         isOpen={showPointEdit}
         onOpenChange={setShowPointEdit}
         customer={currentCustomer}
         onPointUpdate={handlePointUpdate}
       />

       {/* 포인트 이력 다이얼로그 */}
       <PointHistoryDialog
         isOpen={showPointHistory}
         onOpenChange={setShowPointHistory}
         customerId={currentCustomer?.id}
         customerName={currentCustomer?.name}
       />
     </>
   )
 } 
