"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Order } from "@/hooks/use-orders";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/use-orders";
import { 
  User, 
  Phone, 
  Mail, 
  Building, 
  MapPin, 
  Calendar, 
  Clock, 
  Package, 
  MessageSquare,
  FileText,
  CreditCard,
  Truck,
  Home,
  Save,
  X,
  Plus,
  Minus
} from "lucide-react";

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export function OrderEditDialog({ open, onOpenChange, order }: OrderEditDialogProps) {
  const { toast } = useToast();
  const { updateOrder } = useOrders();
  const [isLoading, setIsLoading] = useState(false);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    orderer: {
      name: '',
      contact: '',
      companyName: '',
      email: ''
    },
    receiptType: 'store_pickup' as 'store_pickup' | 'pickup_reservation' | 'delivery_reservation',
    pickupDate: '',
    pickupTime: '',
    recipient: {
      name: '',
      contact: ''
    },
    address: '',
    items: [] as OrderItem[],
    message: {
      type: 'none',
      sender: '',
      content: ''
    },
    specialRequests: '',
    status: 'processing',
    paymentStatus: 'pending',
    paymentMethod: 'card' as 'card' | 'cash' | 'transfer' | 'mainpay' | 'shopping_mall' | 'epay'
  });

  // 주문 데이터가 변경될 때 폼 초기화
  useEffect(() => {
    if (order) {
      setFormData({
        orderer: {
          name: order.orderer.name || '',
          contact: order.orderer.contact || '',
          companyName: order.orderer.company || '',
          email: order.orderer.email || ''
        },
        receiptType: order.receiptType || 'store_pickup',
        pickupDate: order.pickupInfo?.date || order.deliveryInfo?.date || '',
        pickupTime: order.pickupInfo?.time || order.deliveryInfo?.time || '',
        recipient: {
          name: order.pickupInfo?.pickerName || order.deliveryInfo?.recipientName || '',
          contact: order.pickupInfo?.pickerContact || order.deliveryInfo?.recipientContact || ''
        },
        address: order.deliveryInfo?.address || '',
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        message: {
          type: order.message?.type || 'none',
          sender: '',
          content: order.message?.content || ''
        },
        specialRequests: order.request || '',
        status: order.status,
        paymentStatus: order.payment?.status || 'pending',
        paymentMethod: order.payment?.method || 'card'
      });
    }
  }, [order]);

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => {
      // 최상위 레벨 필드인 경우 (receiptType, pickupDate, pickupTime, address, specialRequests, status, paymentStatus, paymentMethod)
      if (field === '') {
        return {
          ...prev,
          [section]: value
        };
      }
      // 중첩된 객체 필드인 경우
      return {
        ...prev,
        [section]: {
          ...prev[section as keyof typeof prev],
          [field]: value
        }
      };
    });
  };

  const handleNestedInputChange = (section: string, subsection: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [subsection]: {
          ...(prev[section as keyof typeof prev] as any)[subsection],
          [field]: value
        }
      }
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 0;
    
    // 기존 주문의 할인 정보 사용
    const discountAmount = order?.summary?.discountAmount || 0;
    const discountRate = order?.summary?.discountRate || 0;
    const pointsUsed = order?.summary?.pointsUsed || 0;
    const pointsEarned = order?.summary?.pointsEarned || 0;
    
    // 할인 적용된 금액 계산
    const discountedSubtotal = subtotal - discountAmount;
    const finalSubtotal = discountedSubtotal - pointsUsed;
    const total = finalSubtotal + deliveryFee;
    
    return {
      subtotal,
      discountAmount,
      discountRate,
      deliveryFee,
      pointsUsed,
      pointsEarned,
      discountedSubtotal,
      finalSubtotal,
      total
    };
  };

  const handleSave = async () => {
    if (!order) return;

    setIsLoading(true);
    try {
      // 필수 필드 검증
      if (!formData.orderer.name || !formData.orderer.contact) {
        toast({
          title: "오류",
          description: "주문자명과 연락처는 필수입니다.",
          variant: "destructive"
        });
        return;
      }

      if (formData.items.length === 0) {
        toast({
          title: "오류",
          description: "최소 하나의 상품을 추가해야 합니다.",
          variant: "destructive"
        });
        return;
      }

             // 픽업/배송 날짜 시간 결합
       let pickupDate = null;
       if (formData.pickupDate && formData.pickupTime) {
         const dateTime = new Date(`${formData.pickupDate}T${formData.pickupTime}`);
         pickupDate = Timestamp.fromDate(dateTime);
       }

      const updatedOrder = {
        orderer: {
          ...order.orderer,
          name: formData.orderer.name,
          contact: formData.orderer.contact,
          company: formData.orderer.companyName,
          email: formData.orderer.email
        },
        receiptType: formData.receiptType,
        items: formData.items,
        message: formData.message.type !== 'none' ? {
          type: formData.message.type,
          content: formData.message.content
        } : null,
        request: formData.specialRequests,
        status: formData.status,
        payment: {
          ...order.payment,
          method: formData.paymentMethod,
          status: formData.paymentStatus
        },
                 summary: {
           ...order.summary,
           subtotal: calculateTotal().subtotal,
           discountAmount: calculateTotal().discountAmount,
           discountRate: calculateTotal().discountRate,
           deliveryFee: calculateTotal().deliveryFee,
           pointsUsed: calculateTotal().pointsUsed,
           pointsEarned: calculateTotal().pointsEarned,
           total: calculateTotal().total
         },
        pickupInfo: (formData.receiptType === 'store_pickup' || formData.receiptType === 'pickup_reservation') ? {
          date: formData.pickupDate,
          time: formData.pickupTime,
          pickerName: formData.recipient.name,
          pickerContact: formData.recipient.contact
        } : null,
        deliveryInfo: formData.receiptType === 'delivery_reservation' ? {
          date: formData.pickupDate,
          time: formData.pickupTime,
          recipientName: formData.recipient.name,
          recipientContact: formData.recipient.contact,
          address: formData.address,
          district: ''
        } : null
      };

      await updateOrder(order.id, updatedOrder);
      
      toast({
        title: "성공",
        description: "주문이 성공적으로 수정되었습니다.",
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "오류",
        description: "주문 수정 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!order) return null;

  const totals = calculateTotal();
  


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            주문 수정
            <span className="text-sm font-normal text-muted-foreground">
              ({order.id})
            </span>
          </DialogTitle>
          <DialogDescription>
            주문 정보를 수정합니다. 변경사항은 즉시 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 주문자 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                주문자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderer-name">주문자명 *</Label>
                  <Input
                    id="orderer-name"
                    value={formData.orderer.name}
                    onChange={(e) => handleInputChange('orderer', 'name', e.target.value)}
                    placeholder="주문자명을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderer-contact">연락처 *</Label>
                  <Input
                    id="orderer-contact"
                    value={formData.orderer.contact}
                    onChange={(e) => handleInputChange('orderer', 'contact', e.target.value)}
                    placeholder="연락처를 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderer-company">회사명</Label>
                  <Input
                    id="orderer-company"
                    value={formData.orderer.companyName}
                    onChange={(e) => handleInputChange('orderer', 'companyName', e.target.value)}
                    placeholder="회사명을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderer-email">이메일</Label>
                  <Input
                    id="orderer-email"
                    type="email"
                    value={formData.orderer.email}
                    onChange={(e) => handleInputChange('orderer', 'email', e.target.value)}
                    placeholder="이메일을 입력하세요"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 수령 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                수령 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                             <div className="space-y-2">
                 <Label>수령 방법</Label>
                 <div className="flex flex-row gap-4">
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="receipt-store-pickup"
                       name="receiptType"
                       value="store_pickup"
                       checked={formData.receiptType === 'store_pickup'}
                       onChange={(e) => handleInputChange('receiptType', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="receipt-store-pickup">매장픽업 (즉시)</Label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="receipt-pickup-reservation"
                       name="receiptType"
                       value="pickup_reservation"
                       checked={formData.receiptType === 'pickup_reservation'}
                       onChange={(e) => handleInputChange('receiptType', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="receipt-pickup-reservation">픽업예약</Label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="receipt-delivery-reservation"
                       name="receiptType"
                       value="delivery_reservation"
                       checked={formData.receiptType === 'delivery_reservation'}
                       onChange={(e) => handleInputChange('receiptType', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="receipt-delivery-reservation">배송예약</Label>
                   </div>
                 </div>
               </div>

              {(formData.receiptType === 'pickup_reservation' || formData.receiptType === 'delivery_reservation') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pickup-date">예약 날짜</Label>
                    <Input
                      id="pickup-date"
                      type="date"
                      value={formData.pickupDate}
                      onChange={(e) => handleInputChange('pickupDate', '', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickup-time">예약 시간</Label>
                    <Input
                      id="pickup-time"
                      type="time"
                      value={formData.pickupTime}
                      onChange={(e) => handleInputChange('pickupTime', '', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {(formData.receiptType === 'store_pickup' || formData.receiptType === 'pickup_reservation') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="picker-name">픽업자명</Label>
                    <Input
                      id="picker-name"
                      value={formData.recipient.name}
                      onChange={(e) => handleInputChange('recipient', 'name', e.target.value)}
                      placeholder="픽업자명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="picker-contact">픽업자 연락처</Label>
                    <Input
                      id="picker-contact"
                      value={formData.recipient.contact}
                      onChange={(e) => handleInputChange('recipient', 'contact', e.target.value)}
                      placeholder="픽업자 연락처를 입력하세요"
                    />
                  </div>
                </div>
              )}

              {formData.receiptType === 'delivery_reservation' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-name">수령인명</Label>
                    <Input
                      id="recipient-name"
                      value={formData.recipient.name}
                      onChange={(e) => handleInputChange('recipient', 'name', e.target.value)}
                      placeholder="수령인명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient-contact">수령인 연락처</Label>
                    <Input
                      id="recipient-contact"
                      value={formData.recipient.contact}
                      onChange={(e) => handleInputChange('recipient', 'contact', e.target.value)}
                      placeholder="수령인 연락처를 입력하세요"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="delivery-address">배송 주소</Label>
                    <Textarea
                      id="delivery-address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', '', e.target.value)}
                      placeholder="배송 주소를 입력하세요"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 주문 상품 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                주문 상품
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border p-4 rounded-lg">
                  <div className="space-y-2">
                    <Label>상품명</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="상품명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>수량</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>단가</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium">₩{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                상품 추가
              </Button>
            </CardContent>
          </Card>

          {/* 메시지 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                메시지 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="message-type">메시지 타입</Label>
                  <Select 
                    value={formData.message.type} 
                    onValueChange={(value) => handleInputChange('message', 'type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">없음</SelectItem>
                      <SelectItem value="card">카드</SelectItem>
                      <SelectItem value="ribbon">리본</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.message.type !== 'none' && (
                  <div className="space-y-2">
                    <Label htmlFor="message-sender">보내는 분</Label>
                    <Input
                      id="message-sender"
                      value={formData.message.sender}
                      onChange={(e) => handleInputChange('message', 'sender', e.target.value)}
                      placeholder="보내는 분을 입력하세요"
                    />
                  </div>
                )}
              </div>
              {formData.message.type !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="message-content">메시지 내용</Label>
                  <Textarea
                    id="message-content"
                    value={formData.message.content}
                    onChange={(e) => handleInputChange('message', 'content', e.target.value)}
                    placeholder="메시지 내용을 입력하세요"
                    rows={4}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 특별 요청사항 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                특별 요청사항
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.specialRequests}
                onChange={(e) => handleInputChange('specialRequests', '', e.target.value)}
                placeholder="특별 요청사항을 입력하세요"
                rows={3}
              />
            </CardContent>
          </Card>

                     {/* 주문 상태 */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Clock className="h-4 w-4" />
                 주문 상태
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="order-status">주문 상태</Label>
                   <Select 
                     value={formData.status} 
                     onValueChange={(value) => handleInputChange('status', '', value)}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="processing">처리중</SelectItem>
                       <SelectItem value="completed">완료</SelectItem>
                       <SelectItem value="canceled">취소</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="payment-status">결제 상태</Label>
                   <Select 
                     value={formData.paymentStatus} 
                     onValueChange={(value) => handleInputChange('paymentStatus', '', value)}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="pending">미결</SelectItem>
                       <SelectItem value="completed">완결</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
             </CardContent>
           </Card>

           {/* 결제 방법 */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <CreditCard className="h-4 w-4" />
                 결제 방법
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Label>결제 수단</Label>
                 <div className="flex flex-row gap-4 flex-wrap">
                                       <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="payment-card"
                        name="paymentMethod"
                        value="card"
                        checked={formData.paymentMethod === 'card'}
                        onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="payment-card">카드</Label>
                    </div>
                                       <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="payment-cash"
                        name="paymentMethod"
                        value="cash"
                        checked={formData.paymentMethod === 'cash'}
                        onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="payment-cash">현금</Label>
                    </div>
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="payment-transfer"
                       name="paymentMethod"
                       value="transfer"
                       checked={formData.paymentMethod === 'transfer'}
                       onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="payment-transfer">계좌이체</Label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="payment-mainpay"
                       name="paymentMethod"
                       value="mainpay"
                       checked={formData.paymentMethod === 'mainpay'}
                       onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="payment-mainpay">메인페이</Label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="payment-shopping-mall"
                       name="paymentMethod"
                       value="shopping_mall"
                       checked={formData.paymentMethod === 'shopping_mall'}
                       onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="payment-shopping-mall">쇼핑몰</Label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <input
                       type="radio"
                       id="payment-epay"
                       name="paymentMethod"
                       value="epay"
                       checked={formData.paymentMethod === 'epay'}
                       onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                       className="h-4 w-4"
                     />
                     <Label htmlFor="payment-epay">이페이</Label>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>

                     {/* 주문 요약 */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <CreditCard className="h-4 w-4" />
                 주문 요약
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-3">
                 <div className="flex justify-between">
                   <span className="text-sm text-muted-foreground">상품 금액</span>
                   <span className="text-sm">₩{totals.subtotal.toLocaleString()}</span>
                 </div>
                 
                 {/* 할인율 적용 */}
                 {totals.discountRate > 0 && (
                   <div className="flex justify-between text-green-600">
                     <span className="text-sm">할인 ({totals.discountRate}%)</span>
                     <span className="text-sm">-₩{totals.discountAmount.toLocaleString()}</span>
                   </div>
                 )}
                 
                 {/* 포인트 사용 */}
                 {totals.pointsUsed > 0 && (
                   <div className="flex justify-between text-blue-600">
                     <span className="text-sm">포인트 사용</span>
                     <span className="text-sm">-₩{totals.pointsUsed.toLocaleString()}</span>
                   </div>
                 )}
                 
                 {/* 배송비 */}
                 {totals.deliveryFee > 0 && (
                   <div className="flex justify-between">
                     <span className="text-sm text-muted-foreground">배송비</span>
                     <span className="text-sm">₩{totals.deliveryFee.toLocaleString()}</span>
                   </div>
                 )}
                 
                 <Separator />
                 
                 {/* 총 결제금액 */}
                 <div className="flex justify-between font-medium">
                   <span>총 결제금액</span>
                   <span>₩{totals.total.toLocaleString()}</span>
                 </div>
                 
                 {/* 포인트 적립 */}
                 {totals.pointsEarned > 0 && (
                   <div className="flex justify-between text-blue-600">
                     <span className="text-sm">적립 포인트</span>
                     <span className="text-sm">+{totals.pointsEarned.toLocaleString()} P</span>
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
