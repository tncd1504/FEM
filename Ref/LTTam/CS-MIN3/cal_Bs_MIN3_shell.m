function [Bs] = cal_Bs_MIN3_shell(dNdx,dNdy,N,a1,a2,a3,b1,b2,b3)
%--------------------------------------------------------
% Purpose:
%  tinh ma tran bien dang cat bang phan tu MIN3
%
% Synopsis:
% [Bs] = cal_Bs_MIN3(dNdx,dNdy,N,a1,a2,a3,b1,b2,b3)
%
% Variable description:
% dNdx - dao ham cua ham dang theo phuong x
% dNdy - dao ham cua ham dang theo phuong y
% N    - ham dang 3 nut
% a1,a2,a3,b1,b2,b3 - la cac thong so hinh hoc cua phan tu
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh
%   FOSAT Group – HCMC, Vietnam
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com
%   Last modified: February 2013
%--------------------------------------------------------------------------
dH1x = 1/2*(a2*(dNdx(3)*N(1)+N(3)*dNdx(1))-a3*(dNdx(1)*N(2)+N(1)*dNdx(2)));
dH2x = 1/2*(a3*(dNdx(1)*N(2)+N(1)*dNdx(2))-a1*(dNdx(2)*N(3)+N(2)*dNdx(3)));
dH3x = 1/2*(a1*(dNdx(2)*N(3)+N(2)*dNdx(3))-a2*(dNdx(3)*N(1)+N(3)*dNdx(1)));

dH1y = 1/2*(a2*(dNdy(3)*N(1)+N(3)*dNdy(1))-a3*(dNdy(1)*N(2)+N(1)*dNdy(2)));
dH2y = 1/2*(a3*(dNdy(1)*N(2)+N(1)*dNdy(2))-a1*(dNdy(2)*N(3)+N(2)*dNdy(3)));
dH3y = 1/2*(a1*(dNdy(2)*N(3)+N(2)*dNdy(3))-a2*(dNdy(3)*N(1)+N(3)*dNdy(1)));

dL1x = 1/2*(b3*(dNdx(1)*N(2)+N(1)*dNdx(2))-b2*(dNdx(3)*N(1)+N(3)*dNdx(1)));
dL2x = 1/2*(b1*(dNdx(2)*N(3)+N(2)*dNdx(3))-b3*(dNdx(1)*N(2)+N(1)*dNdx(2)));
dL3x = 1/2*(b2*(dNdx(3)*N(1)+N(3)*dNdx(1))-b1*(dNdx(2)*N(3)+N(2)*dNdx(3)));

dL1y = 1/2*(b3*(dNdy(1)*N(2)+N(1)*dNdy(2))-b2*(dNdy(3)*N(1)+N(3)*dNdy(1)));
dL2y = 1/2*(b1*(dNdy(2)*N(3)+N(2)*dNdy(3))-b3*(dNdy(1)*N(2)+N(1)*dNdy(2)));
dL3y = 1/2*(b2*(dNdy(3)*N(1)+N(3)*dNdy(1))-b1*(dNdy(2)*N(3)+N(2)*dNdy(3)));
%----------------------
% Ma tran bien dang cat
%----------------------------
% Tinh theo bac tu do (theta)
% Bs = [dNx   dLx   dHx+N
%       dNy  dLy+N    dHy]
%------------------------------------------------------------------------------------
% Bs = [0 0 dNdx(1) dL1x   dH1x+N(1) 0,   0 0 dNdx(2) dL2x   dH2x+N(2) 0,    0 0 dNdx(3) dL3x   dH3x+N(3) 0
%       0 0 dNdy(1) dL1y+N(1) dH1y   0,   0 0 dNdy(2) dL2y+N(2) dH2y   0,    0 0 dNdy(3) dL3y+N(3) dH3y   0];
% Tinh theo bac tu do (beta)
% Bs = [dNx   dHx+N   dLx   
%       dNy    dHy   dLy+N]
 Bs = [0 0 dNdx(1) dH1x+N(1) dL1x    0,   0 0 dNdx(2) dH2x+N(2) dL2x    0,    0 0 dNdx(3) dH3x+N(3) dL3x    0
       0 0 dNdy(1)   dH1y  dL1y+N(1) 0,   0 0 dNdy(2)   dH2y  dL2y+N(2) 0,    0 0 dNdy(3)   dH3y  dL3y+N(3) 0]; 
  
  
  
  
  
  
