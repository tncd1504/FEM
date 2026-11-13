%--------------------------------------------------------------------------
% PURPOSE 
%    Plate problem use Reduce intergration
%    Analysic static for circle plate
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh                                              
%   FOSAT Group – HCMC, Vietnam                                             
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com                                          
%   Last modified: December 2012                                            
%--------------------------------------------------------------------------

clear all; close all 
format long
%------------------------------ materials ---------------------------------
E  = 10920;
nuy = 0.3;
L = 1;                   % chieu dai tam
H = 1;                   % chieu rong tam
kapa=5/6;                % he so hieu chinh cat
t = L/1e1;               % chieu day tam
I = t^3/12;
                         % ma tran vat lieu bien dang uong
Db = I*E/(1-nuy^2)*[1    nuy    0
                           nuy   1     0
                           0     0 (1-nuy)/2];
                         % ma tran vat lieu bien dang cat
Ds = kapa*t*E/2/(1+nuy)*[1  0
                         0  1];
q = -1;                  % load
%--------------------------- Mesh generation ------------------------------
nx = 10;                 % so phan tu theo phuong x
ny = 10;                 % so phan tu theo phuong y
nel= nx*ny;              % number of elements
nnel=4;                  % number of nodes per element
ndof=3;                  % number of dofs per node
nnode=(nx+1)*(ny+1);     % total number of nodes in system
sdof=nnode*ndof;         % total system dofs
edof=nnel*ndof;          % degrees of freedom per element
type_element = 'Q4';     % loai phan tu
[nodes,gcoord] = mesh_square_plate(type_element,L,H,nx,ny);

%------------------------------ Plot grid ---------------------------------
% plot_mesh(type_element,gcoord,nodes,nel)

%---------------------------- buondary condition---------------------------
type_condition = 'CCCC';
[bcdof,bcval]=boundary_condition(type_condition,ndof,nx,ny);

% ------------------------ Tinh ma tran do cung ---------------------------
K = zeros(sdof,sdof);  % khai bao ma tran do cung ban dau la zeros
F = zeros(sdof,1);     % khai bao ma tran tai toan cuc ban dau la zeros
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
%--------------------------------------------------------------------------
%                        tinh ma tran do cung uon
%--------------------------------------------------------------------------
%--------------------------- diem Gauss -----------------------------------
Kb = zeros(sdof,sdof);  % khai bao ma tran do cung ban dau la zeros
nglxb = 2; nglyb = 2;                    % 2x2 Gauss-Legendre quadrature
nglb  = nglxb*nglyb;                      % number of sampling points per element
[pointb,weightb]=Gauss_2D(nglxb,nglyb);  % sampling points & weights
for iel=1:nel               % vong lap qua cac phan tu de tinh K
    nd = nodes(iel,:);      % cac nut cua phan tu thu i
    xcoord = gcoord(nd,1);  % toa do phuong x cho cac nut cua phan tu
    ycoord = gcoord(nd,2);  % toa do phuong y cho cac nut cua phan tu
    % vong lap qua cac diem Gauss
    kb = zeros(edof,edof);
    ks = zeros(edof,edof);
    f  = zeros(edof,1);
    for intx=1:nglxb
        x = pointb(1,intx);          % sampling point in x-axis
        wtx= weightb(1,intx);        % weight in x-axis
        for inty=1:nglyb
            y = pointb(2,inty);      % sampling point in y-axis
            wty= weightb(2,inty);    % weight in y-axis
            
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
            kb = kb + Bb'*Db*Bb*wtx*wty*detjacob;

            f = f+ q*[shape(1); 0; 0; shape(2); 0; 0;...
                      shape(3); 0; 0; shape(4); 0; 0]*wtx*wty*detjacob;
        end
    end
    % Lap ghep vao ma tran Ke vao K toan cuc
    index=index_assemble(nd,nnel,ndof);
    Kb(index,index)=Kb(index,index)+kb;
    F(index)=F(index)+f;    
end

%--------------------------------------------------------------------------
%                        tinh ma tran do cung cat ks
%--------------------------------------------------------------------------
%--------------------------- diem Gauss -----------------------------------
Ks = zeros(sdof,sdof);  % khai bao ma tran do cung ban dau la zeros
nglxs = 1; nglys = 1;                  % 2x2 Gauss-Legendre quadrature
ngls  = nglxs*nglys;                    % number of sampling points per element
[points,weights]=Gauss_2D(nglxs,nglys);% sampling points & weights
for iel=1:nel             % vong lap qua cac phan tu de tinh K
    nd = nodes(iel,:);    % cac nut cua phan tu thu i
    xcoord = gcoord(nd,1);  % toa do phuong x cho cac nut cua phan tu
    ycoord = gcoord(nd,2);  % toa do phuong y cho cac nut cua phan tu
    % vong lap qua cac diem Gauss
    kb = zeros(edof,edof);
    ks = zeros(edof,edof);
    f  = zeros(edof,1);
    for intx=1:nglxs
        x = points(intx);           % sampling point in x-axis
        wtx= weights(intx);         % weight in x-axis
        for inty=1:nglys
            y = points(inty);       % sampling point in y-axis
            wty= weights(inty);     % weight in y-axis
            
            % tinh ham dang va dao ham cua no
            
            [shape,dNdxi,dNdeta] = shape_Q4(x,y,1);
            
            % Tinh Jacobi
            
            [jacob] = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);
            detjacob = det(jacob); % dinh thuc Jacobian
            invjacob = inv(jacob); % nghich dao Jacobian
            
            % dao ham ham dang dang theo x va theo y
            
            [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob);

            % ma tran bien dang cat Bs
            Bs = [-dNdx(1) shape(1)  0     -dNdx(2)  shape(2)  0     -dNdx(3)  shape(3)   0   -dNdx(4)   shape(4)   0 ;
                  -dNdy(1)    0   shape(1) -dNdy(2)     0   shape(2) -dNdy(3)     0    shape(3)  -dNdy(4)   0    shape(4)];
                        
            Bs = Bs*T;
            % tinh ma tran do cung phan tu cat
            ks = ks + Bs'*Ds*Bs*wtx*wty*detjacob;
            f = f+ q*[shape(1); 0; 0; shape(2); 0; 0;...
                      shape(3); 0; 0; shape(4); 0; 0]*wtx*wty*detjacob;
        end
    end
    % Lap ghep vao ma tran Ke vao K toan cuc
    index=index_assemble(nd,nnel,ndof);
    Ks(index,index)=Ks(index,index)+ks;  
end
K = Kb + Ks;
%--------------------------------------------------------------------------
%                     dieu kien bien va giai tim chuyen vi
%--------------------------------------------------------------------------
[K,F] = apply_condition(K,F,bcdof,bcval);
U = inv(K)*F;
W = U(1:3:end);
Wmax = max(abs(W));
%--------------------------------------------------------------------------
%                               so sanh nghiem
%--------------------------------------------------------------------------
D1 = E*t^3/12/(1-nuy^2);
sosanh = Wmax*D1/L^4

% ve chuyen vi
figure('color',[1 1 1])
trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
shading interp
view(0,90)
return






% %--------------------------------------------------------------------------
% %                                HAU XU LY
% %--------------------------------------------------------------------------
% % ve chuyen vi
% figure('color',[1 1 1])
% trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
% shading interp
% view(0,90)
% return
% %--------------------------------------------------------------------------
% %                     tinh ung suat do bien dang uon tai nut
% %--------------------------------------------------------------------------
% % ------------ ma tran lien he toa do diem gauss va toa do nut ------------
% extra_mat=[1+0.5*sqrt(3)     -0.5       1-0.5*sqrt(3)   -0.5;
%     -0.5       1+0.5*sqrt(3)      -0.5      1-0.5*sqrt(3);
%     1-0.5*sqrt(3)     -0.5      1+0.5*sqrt(3)    -0.5;
%     -0.5       1-0.5*sqrt(3)      -0.5      1+0.5*sqrt(3)];
% 
% % ------------------- vong lap qua cac phan tu va Gauss -------------------
% stress_nod=zeros(3,nnode);   % ung suat nut
% nadjele_nod=zeros(nnode,1);  %
% 
% for iel=1:nel             % vong lap qua cac phan tu de tinh K
%     nd = nodes(iel,:);  % so nut cua phan tu thu i
%     x = gcoord(nd,1); % toa do phuong x cho cac nut cua phan tu
%     y = gcoord(nd,2); % toa do phuong y cho cac nut cua phan tu
%     
%     % xac dinh dof va chuyen vi cua phan tu thu i
%     index=index_assemble(nd,nnel,ndof);
%     edisp = U(index);
%     
%     % vong lap qua cac diem Gauss
%     estress_gp2=cell(1,nglb); %ung suat tai diem Gauss
%     %     return
%     ino=0;
%     nd = nodes(iel,:);      % cac nut cua phan tu thu i
%     xcoord = gcoord(nd,1);  % toa do phuong x cho cac nut cua phan tu
%     ycoord = gcoord(nd,2);  % toa do phuong y cho cac nut cua phan tu
%     % vong lap qua cac diem Gauss
%     kb = zeros(edof,edof);
%     ks = zeros(edof,edof);
%     f  = zeros(edof,1);
%     for intx=1:nglxb
%         x = pointb(1,intx);          % sampling point in x-axis
%         wtx= weightb(1,intx);        % weight in x-axis
%         for inty=1:nglyb
%             y = pointb(2,inty);      % sampling point in y-axis
%             wty= weightb(2,inty);    % weight in y-axis
%             
%             % tinh ham dang va dao ham cua no
%             
%             [shape,dNdxi,dNdeta] = shape_Q4(x,y,1);
%             
%             % Tinh Jacobi
%             
%             [jacob] = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);
%             detjacob = det(jacob); % dinh thuc Jacobian
%             invjacob = inv(jacob); % nghich dao Jacobian
%             
%             % dao ham ham dang dang theo x va theo y
%             
%             [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob);
%             
%             % ma tran bien dang uon Bb
%             Bb = [0  dNdx(1)    0     0  dNdx(2)   0      0  dNdx(3)    0      0  dNdx(4)   0 ;
%                   0    0     dNdy(1)  0    0     dNdy(2)  0    0      dNdy(3)  0    0     dNdy(4);
%                   0  dNdy(1) dNdx(1)  0  dNdy(2) dNdx(2)  0  dNdy(3)  dNdx(3)  0  dNdy(4) dNdx(4)];
%             Bb = Bb*T;     
%             
%             % tinh ma tran bien dang
%             estrain_gp = Bb*edisp;         % bien dang tai diem Gauss
%             estress_gp = Db*estrain_gp;    % ung suat tai diem Gauss
%             
%             ino=ino+1;
%             if ino==2
%                 estress_gp2{1,4}(1:3)=estress_gp(:);
%             elseif ino==3
%                 estress_gp2{1,2}(1:3)=estress_gp(:);
%             elseif ino==4
%                 estress_gp2{1,3}(1:3)=estress_gp(:);
%             else
%                 estress_gp2{1,1}(1:3)=estress_gp(:);
%             end
%         end
%         
%     end
% 
%     % tinh ung suat nut
%     for i=1:nnel  % loop for 4 nodes of (iel)-th element
%         temp_stress=zeros(3,1);
%         for ngp=1:nglb   % loop for 4 Gauss integration points
%             temp_stress(:) = temp_stress(:) + extra_mat(i,ngp) * estress_gp2{1,ngp}(:);
%         end
%         stress_nod(:,nd(i)) = stress_nod(:,nd(i)) + temp_stress(:);
%         % tim phan tu co chung nut
%         nadjele_nod(nd(i)) = nadjele_nod(nd(i)) + 1;
%     end
% end
% 
% % ung suat trung binh cua tung nut cua he
% for i=1:nnode
%     stress_nod(:,i)=stress_nod(:,i)/nadjele_nod(i);
% end
% % ------------------------- Tinh ung suat Von Mises -----------------------
% stress_von=[];
% for i=1:length(stress_nod)
%     stress_von=[stress_von;sqrt(stress_nod(1,i)^2+stress_nod(2,i)^2+3*stress_nod(3,i)^2-stress_nod(1,i)*stress_nod(2,i))];
% end
% 
% 
% 
% 
% 
