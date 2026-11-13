
% MATLAB codes for Finite Element Analysis
clear all; close all 
% materials
E  = 10920;
nuy = 0.3;
L = 1;                   % chieu dai tam
H = 1;                   % chieu rong tam
kapa=5/6;
t = L/1e6;
I = t^3/12;
% bending part
C_bending = I*E/(1-nuy^2)*[1    nuy    0
                           nuy   1     0
                           0     0 (1-nuy)/2];
% shear part
C_shear = kapa*t*E/2/(1+nuy)*[1  0
                              0  1];
% load
q = -1;
% Mesh generation
nx = 20;                  % so phan tu theo phuong x
ny = 20;                  % so phan tu theo phuong y
nel= nx*ny;              % number of elements
nnel=4;                  % number of nodes per element
ndof=3;                  % number of dofs per node
nnode=(nx+1)*(ny+1);     % total number of nodes in system
sdof=nnode*ndof;         % total system dofs
edof=nnel*ndof;          % degrees of freedom per element
[nodes,gcoord] = mesh_square_palte(L,H,nx,ny);

%------------------------------ Plot grid ---------------------------------
% plot_mesh(gcoord,nodes,nel)
type = 'SSSS';
[bcdof,bcval]=boundary_condition(type,ndof,nx,ny);
% return
%------------------------- diem Gauss ------------------------
nglx = 2; ngly = 2;                    % 2x2 Gauss-Legendre quadrature
ngl  = nglx*ngly;                      % number of sampling points per element
[point,weight]=Gauss_2D(nglx,ngly);  % sampling points & weights

% ------------------------ Tinh ma tran do cung ---------------------------
K = zeros(sdof,sdof);  % khai bao ma tran do cung ban dau la zeros
F = zeros(sdof,1);     % khai bao matran tai toan cuc ban dau
% ma tran doi dau
T = [1  0  0  0  0  0  0  0  0  0  0  0
     0  0  1  0  0  0  0  0  0  0  0  0
     0 -1  0  0  0  0  0  0  0  0  0  0
     0  0  0  1  0  0  0  0  0  0  0  0
     0  0  0  0  0  1  0  0  0  0  0  0
     0  0  0  0 -1  0  0  0  0  0  0  0
     0  0  0  0  0  0  1  0  0  0  0  0
     0  0  0  0  0  0  0  0  1  0  0  0
     0  0  0  0  0  0  0 -1  0  0  0  0
     0  0  0  0  0  0  0  0  0  1  0  0
     0  0  0  0  0  0  0  0  0  0  0  1
     0  0  0  0  0  0  0  0  0  0 -1  0];
 
for iel=1:nel             % vong lap qua cac phan tu de tinh K
    nd = nodes(iel,:);    % cac nut cua phan tu thu i
    xcoord = gcoord(nd,1);  % toa do phuong x cho cac nut cua phan tu
    ycoord = gcoord(nd,2);  % toa do phuong y cho cac nut cua phan tu
    % vong lap qua cac diem Gauss
    kb = zeros(edof,edof);
    ks = zeros(edof,edof);
    f  = zeros(edof,1);
    for intx=1:nglx
        x = point(1,intx);          % sampling point in x-axis
        wtx= weight(1,intx);         % weight in x-axis
        for inty=1:ngly
            y = point(2,inty);      % sampling point in y-axis
            wty= weight(2,inty);     % weight in y-axis
            
            % tinh ham dang va dao ham cua no
            
            [shape,dNdxi,dNdeta] = shape_Q4(x,y,1);
            
            % Tinh Jacobi
            
            [jacob] = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);
            detjacob = det(jacob); % dinh thuc Jacobian
            invjacob = inv(jacob); % nghich dao Jacobian
            
            % dao ham ham dang dang theo x va theo y
            
            [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob);
            
            % ma tran bien dang uon Bb
            Bb = [0  dNdx(1)    0     0  dNdx(2)   0      0  dNdx(3)    0      0  dNdx(4)   0 ;
                  0    0     dNdy(1)  0    0     dNdy(2)  0    0      dNdy(3)  0    0     dNdy(4);
                  0  dNdy(1) dNdx(1)  0  dNdy(2) dNdx(2)  0  dNdy(3)  dNdx(3)  0  dNdy(4) dNdx(4)];
            Bb = Bb*T;
            % tinh ma tran do cung phan tu uon
            kb = kb + Bb'*C_bending*Bb*wtx*wty*detjacob;
            
            % ma tran bien dang cat Bs
            Bs = [dNdx(1) shape(1)  0     dNdx(2)  shape(2)  0     dNdx(3)  shape(3)   0   dNdx(4)   shape(4)   0 ;
                  dNdy(1)    0   shape(1) dNdy(2)     0   shape(2) dNdy(3)     0    shape(3)  dNdy(4)   0    shape(4)];
            Bs = Bs*T;
            % tinh ma tran do cung phan tu cat
            ks = ks + Bs'*C_shear*Bs*wtx*wty*detjacob;
            f = f+ q*[shape(1); 0; 0; shape(2); 0; 0;...
                      shape(3); 0; 0; shape(4); 0; 0]*wtx*wty*detjacob;
        end
    end
    % ma tran do cung phan tu
    ke = kb + ks;
    % Lap ghep vao ma tran Ke vao K toan cuc
    index=index_assemble(nd,nnel,ndof);
    K(index,index)=K(index,index)+ke;
    F(index)=F(index)+f;    
end

% ap dieu kien bien va giai tim chuyen vi

[K,F] = apply_condition(K,F,bcdof,bcval);
U = inv(K)*F;
W = U(1:3:end);
Wmax = max(abs(W));


D1 = E*t^3/12/(1-nuy^2);

sosanh = Wmax*D1/L^4

figure('color',[1 1 1])
trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
shading interp
view(0,90)








